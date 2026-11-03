import { and, desc, eq, or, asc } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {
  ACCESS_LEVELS,
  RATE_LIMITS,
  type AccessLevelValue,
} from '../../shared/constants';
import type {
  ConversationSummary,
  EntityType,
  InboxFolder,
  MessageItem,
} from '../../shared/types';
import { AccessControlError, AccessService } from './access.service';
import { generateId } from './auth.service';
import { checkRateLimit } from '../middleware/rateLimit';
import { forwardInboundMessageToEmail } from './email.service';
import type { Env } from '../env';

export interface InboxTarget {
  type: EntityType;
  id: string;
}

export class MessageService {
  /**
   * Finds an existing conversation between a sender user and a recipient (user or company).
   * For user-to-user conversations, checks both (A -> B) and (B -> A).
   */
  static async findExistingConversation(
    db: DrizzleD1Database<typeof schema>,
    userAId: string,
    recipientType: EntityType,
    recipientId: string
  ) {
    if (recipientType === 'user') {
      const rows = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.recipientType, 'user'),
            or(
              and(
                eq(schema.conversations.initiatorUserId, userAId),
                eq(schema.conversations.recipientUserId, recipientId)
              ),
              and(
                eq(schema.conversations.initiatorUserId, recipientId),
                eq(schema.conversations.recipientUserId, userAId)
              )
            )
          )
        )
        .limit(1);
      return rows[0] || null;
    }

    const rows = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.initiatorUserId, userAId),
          eq(schema.conversations.recipientType, 'company'),
          eq(schema.conversations.recipientCompanyId, recipientId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  /**
   * Starts a new conversation or appends to an existing conversation between senderUserId and recipient.
   * Enforces:
   * - Blocking overrides all access levels (in both directions).
   * - Self-messaging is disallowed.
   * - Rate limiting on Level 1 cold outreach.
   * - Never alters access_permissions.
   */
  static async startConversation(
    db: DrizzleD1Database<typeof schema>,
    params: {
      senderUserId: string;
      recipientType: EntityType;
      recipientId: string;
      subject?: string;
      body: string;
      requireFollowBeforeMessage?: boolean;
      env?: Partial<Env>;
    }
  ): Promise<{
    conversationId: string;
    messageId: string;
    senderAccessLevel: AccessLevelValue;
    forwardedToEmail: string | null;
  }> {
    const {
      senderUserId,
      recipientType,
      recipientId,
      subject = '',
      body,
      requireFollowBeforeMessage = false,
      env = {},
    } = params;
    const trimmedBody = body.trim();
    if (!trimmedBody || trimmedBody.length > 4000) {
      throw new AccessControlError('Message body must be between 1 and 4,000 characters.', 400);
    }

    if (recipientType === 'user' && senderUserId === recipientId) {
      throw new AccessControlError('You cannot send a message to yourself.', 400);
    }

    // Verify sender is active
    const senderRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, senderUserId))
      .limit(1);
    if (!senderRows[0] || senderRows[0].status !== 'active') {
      throw new AccessControlError('Sender account is not active.', 403);
    }

    // Verify recipient exists and is active
    let recipientAllowLevel1 = true;
    let recipientUserRow: typeof schema.users.$inferSelect | null = null;
    let recipientCompanyRow: typeof schema.companies.$inferSelect | null = null;

    if (recipientType === 'user') {
      const recRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, recipientId))
        .limit(1);
      if (!recRows[0] || recRows[0].status !== 'active') {
        throw new AccessControlError('Recipient user is not available.', 404);
      }
      recipientUserRow = recRows[0];
      recipientAllowLevel1 = recRows[0].allowLevel1Messages === 1;
    } else {
      const compRows = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, recipientId))
        .limit(1);
      if (!compRows[0] || compRows[0].status !== 'active') {
        throw new AccessControlError('Recipient company is not available.', 404);
      }
      recipientCompanyRow = compRows[0];
    }

    // Check directional access level: sender -> recipient
    const senderAccessLevel = await AccessService.getAccessLevel(
      db,
      senderUserId,
      recipientType,
      recipientId
    );

    if (senderAccessLevel === ACCESS_LEVELS.BLOCKED) {
      throw new AccessControlError('You are unable to send messages to this recipient.', 403);
    }

    // If user-to-user, also verify the sender hasn't blocked the recipient
    if (recipientType === 'user') {
      const reverseAccess = await AccessService.getAccessLevel(
        db,
        recipientId,
        'user',
        senderUserId
      );
      if (reverseAccess === ACCESS_LEVELS.BLOCKED) {
        throw new AccessControlError(
          'You have blocked this user. Unblock them before sending a message.',
          403
        );
      }
    }

    if (senderAccessLevel === ACCESS_LEVELS.GENERAL && !recipientAllowLevel1) {
      throw new AccessControlError(
        'This professional is currently only accepting messages from Recognized (Level 2) and Direct (Level 3) contacts.',
        403
      );
    }

    // Check or ensure follow relationship so the recipient always sees the sender in their Followers list
    // and can control their Level 1 - 3 access.
    const followCondition =
      recipientType === 'user'
        ? and(
            eq(schema.follows.followerUserId, senderUserId),
            eq(schema.follows.targetType, 'user'),
            eq(schema.follows.targetUserId, recipientId)
          )
        : and(
            eq(schema.follows.followerUserId, senderUserId),
            eq(schema.follows.targetType, 'company'),
            eq(schema.follows.targetCompanyId, recipientId)
          );
    const existingFollow = await db.select().from(schema.follows).where(followCondition).limit(1);

    if (!existingFollow[0] && requireFollowBeforeMessage) {
      throw new AccessControlError(
        'You must follow this recipient before sending a message. Following starts you at Level 1 — General Access so the recipient can see you in their Followers list and manage your access level (Level 1–3).',
        403
      );
    }

    // General per-minute anti-spam check
    const minuteRate = await checkRateLimit(
      db,
      `msg_min:${senderUserId}`,
      RATE_LIMITS.MESSAGE_SEND_MINUTE_MAX,
      60 * 1000
    );
    if (!minuteRate.allowed) {
      throw new AccessControlError('Rate limit exceeded. Please wait before sending more messages.', 429);
    }

    const existingConv = await this.findExistingConversation(
      db,
      senderUserId,
      recipientType,
      recipientId
    );

    // If initiating a brand-new conversation at Level 1, enforce strict cold-outreach rate limits
    if (!existingConv && senderAccessLevel === ACCESS_LEVELS.GENERAL) {
      const hourlyLimit = await checkRateLimit(
        db,
        `l1_hour:${senderUserId}`,
        RATE_LIMITS.LEVEL1_OUTREACH_HOURLY_MAX,
        60 * 60 * 1000
      );
      if (!hourlyLimit.allowed) {
        throw new AccessControlError(
          `Level 1 General outreach is limited to ${RATE_LIMITS.LEVEL1_OUTREACH_HOURLY_MAX} new contacts per hour to prevent unsolicited mass outreach.`,
          429
        );
      }

      const dailyLimit = await checkRateLimit(
        db,
        `l1_day:${senderUserId}`,
        RATE_LIMITS.LEVEL1_OUTREACH_DAILY_MAX,
        24 * 60 * 60 * 1000
      );
      if (!dailyLimit.allowed) {
        throw new AccessControlError(
          `Level 1 General outreach is limited to ${RATE_LIMITS.LEVEL1_OUTREACH_DAILY_MAX} new contacts per day.`,
          429
        );
      }
    }

    const now = Date.now();
    const preview = trimmedBody.slice(0, 140);

    // Ensure sender is recorded in follows so the recipient always sees them in their Followers list
    // and can manage their Level 1 - 3 access level.
    if (!existingFollow[0]) {
      await db.insert(schema.follows).values({
        id: generateId('flw'),
        followerUserId: senderUserId,
        targetType: recipientType,
        targetUserId: recipientType === 'user' ? recipientId : null,
        targetCompanyId: recipientType === 'company' ? recipientId : null,
        createdAt: now,
      });
    }

    let conversationId: string;
    const normalizedSubject = subject.trim().slice(0, 140);
    if (existingConv) {
      conversationId = existingConv.id;
      const isInitiator = existingConv.initiatorUserId === senderUserId;
      await db
        .update(schema.conversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: preview,
          lastMessageSenderId: senderUserId,
          initiatorArchivedAt: null,
          recipientArchivedAt: null,
          ...(isInitiator ? { initiatorLastReadAt: now } : { recipientLastReadAt: now }),
          updatedAt: now,
        })
        .where(eq(schema.conversations.id, conversationId));
    } else {
      conversationId = generateId('cnv');
      await db.insert(schema.conversations).values({
        id: conversationId,
        subject: normalizedSubject,
        initiatorUserId: senderUserId,
        recipientType,
        recipientUserId: recipientType === 'user' ? recipientId : null,
        recipientCompanyId: recipientType === 'company' ? recipientId : null,
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderId: senderUserId,
        initiatorLastReadAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const messageId = generateId('msg');
    await db.insert(schema.messages).values({
      id: messageId,
      conversationId,
      senderUserId,
      sentAsCompanyId: null,
      body: trimmedBody,
      createdAt: now,
      readAt: null,
    });

    // Notify recipient if sender has Level 2 or Level 3 access (or subtle notification for Direct/Recognized)
    if (recipientType === 'user' && senderAccessLevel >= ACCESS_LEVELS.RECOGNIZED) {
      await db.insert(schema.notifications).values({
        id: generateId('ntf'),
        userId: recipientId,
        type: 'new_message',
        title: `New ${senderAccessLevel === ACCESS_LEVELS.DIRECT ? 'Direct' : 'Recognized'} message from ${senderRows[0].name}`,
        body: preview,
        referenceType: 'conversation',
        referenceId: conversationId,
        createdAt: now,
      });
    }

    // Per-Level Email Forwarding (Level 1 -> e.g. info@, Level 2 -> e.g. work@, Level 3 -> e.g. personal@)
    let forwardedToEmail: string | null = null;
    const senderSubtitle =
      [senderRows[0].position, senderRows[0].companyName].filter(Boolean).join(' · ') ||
      senderRows[0].headline;

    if (recipientType === 'user' && recipientUserRow) {
      const fwdResult = await forwardInboundMessageToEmail(env, {
        recipientPrimaryEmail: recipientUserRow.email,
        recipientName: recipientUserRow.name,
        recipientEmailNotifPrefsJson: recipientUserRow.emailNotifPrefsJson,
        senderName: senderRows[0].name,
        senderSubtitle,
        senderAccessLevel,
        subject: existingConv?.subject || normalizedSubject,
        body: trimmedBody,
        conversationId,
      });
      if (fwdResult.forwarded && fwdResult.targetEmail) {
        forwardedToEmail = fwdResult.targetEmail;
      }
    } else if (recipientType === 'company' && recipientCompanyRow) {
      // Forward to company owners/admins according to their per-level email routing rules
      const admins = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          emailNotifPrefsJson: schema.users.emailNotifPrefsJson,
          role: schema.companyMembers.role,
        })
        .from(schema.companyMembers)
        .innerJoin(schema.users, eq(schema.companyMembers.userId, schema.users.id))
        .where(eq(schema.companyMembers.companyId, recipientCompanyRow.id));

      for (const adm of admins) {
        if (adm.role === 'owner' || adm.role === 'admin') {
          const fwdResult = await forwardInboundMessageToEmail(env, {
            recipientPrimaryEmail: adm.email,
            recipientName: adm.name,
            recipientEmailNotifPrefsJson: adm.emailNotifPrefsJson,
            senderName: senderRows[0].name,
            senderSubtitle,
            senderAccessLevel,
            subject: existingConv?.subject || normalizedSubject,
            body: trimmedBody,
            conversationId,
            inboxContextLabel: `${recipientCompanyRow.name} Company Inbox`,
          });
          if (fwdResult.forwarded && fwdResult.targetEmail && !forwardedToEmail) {
            forwardedToEmail = fwdResult.targetEmail;
          }
        }
      }
    }

    return { conversationId, messageId, senderAccessLevel, forwardedToEmail };
  }

  /**
   * Appends a reply to an existing conversation.
   * CRITICAL INVARIANT: A recipient's reply NEVER modifies the sender's access level.
   */
  static async replyToConversation(
    db: DrizzleD1Database<typeof schema>,
    params: {
      actorUserId: string;
      conversationId: string;
      body: string;
      sendAsCompanyId?: string | null;
      env?: Partial<Env>;
    }
  ): Promise<{ messageId: string; forwardedToEmail: string | null }> {
    const { actorUserId, conversationId, body, sendAsCompanyId, env = {} } = params;
    const trimmedBody = body.trim();
    if (!trimmedBody || trimmedBody.length > 4000) {
      throw new AccessControlError('Message body must be between 1 and 4,000 characters.', 400);
    }

    const convRows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    const conv = convRows[0];
    if (!conv) {
      throw new AccessControlError('Conversation not found.', 404);
    }

    // Determine whether actorUserId is the initiator side or recipient side
    let actingSide: 'initiator' | 'recipient' | null = null;
    let effectiveCompanyId: string | null = null;

    if (conv.recipientType === 'user') {
      if (conv.initiatorUserId === actorUserId) {
        actingSide = 'initiator';
      } else if (conv.recipientUserId === actorUserId) {
        actingSide = 'recipient';
      }
    } else if (conv.recipientType === 'company' && conv.recipientCompanyId) {
      const isCompanyAdmin = await AccessService.isCompanyInboxAdmin(
        db,
        actorUserId,
        conv.recipientCompanyId
      );
      if (sendAsCompanyId && sendAsCompanyId === conv.recipientCompanyId && isCompanyAdmin) {
        actingSide = 'recipient';
        effectiveCompanyId = conv.recipientCompanyId;
      } else if (conv.initiatorUserId === actorUserId) {
        actingSide = 'initiator';
      } else if (isCompanyAdmin) {
        actingSide = 'recipient';
        effectiveCompanyId = conv.recipientCompanyId;
      }
    }

    if (!actingSide) {
      throw new AccessControlError('You do not have permission to access this conversation.', 403);
    }

    // Check blocking in both directions before allowing any message in the thread
    let initiatorToRecipientAccess: AccessLevelValue = ACCESS_LEVELS.GENERAL;
    let recipientToInitiatorAccess: AccessLevelValue = ACCESS_LEVELS.GENERAL;

    if (conv.recipientType === 'user' && conv.recipientUserId) {
      initiatorToRecipientAccess = await AccessService.getAccessLevel(
        db,
        conv.initiatorUserId,
        'user',
        conv.recipientUserId
      );
      recipientToInitiatorAccess = await AccessService.getAccessLevel(
        db,
        conv.recipientUserId,
        'user',
        conv.initiatorUserId
      );
      if (
        initiatorToRecipientAccess === ACCESS_LEVELS.BLOCKED ||
        recipientToInitiatorAccess === ACCESS_LEVELS.BLOCKED
      ) {
        throw new AccessControlError(
          'Messaging in this conversation is disabled because one participant has blocked the other.',
          403
        );
      }
    } else if (conv.recipientType === 'company' && conv.recipientCompanyId) {
      initiatorToRecipientAccess = await AccessService.getAccessLevel(
        db,
        conv.initiatorUserId,
        'company',
        conv.recipientCompanyId
      );
      if (initiatorToRecipientAccess === ACCESS_LEVELS.BLOCKED) {
        throw new AccessControlError(
          'Messaging in this conversation is disabled because the contact is blocked.',
          403
        );
      }
    }

    const now = Date.now();
    const preview = trimmedBody.slice(0, 140);
    const messageId = generateId('msg');

    await db.insert(schema.messages).values({
      id: messageId,
      conversationId: conv.id,
      senderUserId: actorUserId,
      sentAsCompanyId: effectiveCompanyId,
      body: trimmedBody,
      createdAt: now,
      readAt: null,
    });

    await db
      .update(schema.conversations)
      .set({
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderId: actorUserId,
        initiatorArchivedAt: null,
        recipientArchivedAt: null,
        ...(actingSide === 'initiator'
          ? { initiatorLastReadAt: now }
          : { recipientLastReadAt: now }),
        updatedAt: now,
      })
      .where(eq(schema.conversations.id, conv.id));

    // Forward reply to the counterparty according to their per-level email forwarding settings
    let forwardedToEmail: string | null = null;
    const actorRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, actorUserId))
      .limit(1);
    const actorUser = actorRows[0];

    if (actorUser) {
      const senderSubtitle =
        [actorUser.position, actorUser.companyName].filter(Boolean).join(' · ') ||
        actorUser.headline;

      if (conv.recipientType === 'user' && conv.recipientUserId) {
        const targetUserId =
          actingSide === 'initiator' ? conv.recipientUserId : conv.initiatorUserId;
        const effectiveAccess =
          actingSide === 'initiator' ? initiatorToRecipientAccess : recipientToInitiatorAccess;

        const targetRows = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, targetUserId))
          .limit(1);

        if (targetRows[0]) {
          const fwdResult = await forwardInboundMessageToEmail(env, {
            recipientPrimaryEmail: targetRows[0].email,
            recipientName: targetRows[0].name,
            recipientEmailNotifPrefsJson: targetRows[0].emailNotifPrefsJson,
            senderName: actorUser.name,
            senderSubtitle,
            senderAccessLevel: effectiveAccess,
            subject: conv.subject,
            body: trimmedBody,
            conversationId: conv.id,
          });
          if (fwdResult.forwarded && fwdResult.targetEmail) {
            forwardedToEmail = fwdResult.targetEmail;
          }
        }
      }
    }

    return { messageId, forwardedToEmail };
  }

  /**
   * Lists conversations for an inbox (Personal user inbox or Company inbox) filtered by folder:
   * - 'general' (Level 1)
   * - 'recognized' (Level 2)
   * - 'direct' (Level 3)
   * - 'sent'
   * - 'archived'
   * Also returns unread counts across all folders for the target inbox.
   */
  static async listInbox(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    inboxTarget: InboxTarget,
    folder: InboxFolder
  ): Promise<{
    conversations: ConversationSummary[];
    unreadCounts: Record<'general' | 'recognized' | 'direct', number>;
    folderCounts: Record<InboxFolder, number>;
  }> {
    await AccessService.assertCanManageInbox(db, actorUserId, inboxTarget.type, inboxTarget.id);

    // Fetch all conversations involving this inboxTarget
    const whereClause =
      inboxTarget.type === 'user'
        ? or(
            eq(schema.conversations.initiatorUserId, inboxTarget.id),
            and(
              eq(schema.conversations.recipientType, 'user'),
              eq(schema.conversations.recipientUserId, inboxTarget.id)
            )
          )
        : and(
            eq(schema.conversations.recipientType, 'company'),
            eq(schema.conversations.recipientCompanyId, inboxTarget.id)
          );

    const rawConvs = await db
      .select()
      .from(schema.conversations)
      .where(whereClause)
      .orderBy(desc(schema.conversations.lastMessageAt));

    const unreadCounts: Record<'general' | 'recognized' | 'direct', number> = {
      general: 0,
      recognized: 0,
      direct: 0,
    };
    const folderCounts: Record<InboxFolder, number> = {
      general: 0,
      recognized: 0,
      direct: 0,
      sent: 0,
      archived: 0,
    };

    const enriched: Array<{
      summary: ConversationSummary;
      hasInbound: boolean;
      hasOutbound: boolean;
    }> = [];

    for (const conv of rawConvs) {
      const isInitiatorSide =
        inboxTarget.type === 'user' && conv.initiatorUserId === inboxTarget.id;

      const myArchivedAt = isInitiatorSide ? conv.initiatorArchivedAt : conv.recipientArchivedAt;
      const myLastReadAt = isInitiatorSide ? conv.initiatorLastReadAt : conv.recipientLastReadAt;

      // Determine counterparty identity
      let counterpartyType: EntityType;
      let counterpartyId: string;
      if (isInitiatorSide) {
        counterpartyType = conv.recipientType as EntityType;
        counterpartyId =
          conv.recipientType === 'user' ? conv.recipientUserId! : conv.recipientCompanyId!;
      } else {
        counterpartyType = 'user';
        counterpartyId = conv.initiatorUserId;
      }

      // Fetch counterparty metadata
      let counterpartyName = 'Unknown';
      let counterpartySlug = '';
      let counterpartySubtitle = '';
      let counterpartyAvatarUrl: string | null = null;

      if (counterpartyType === 'user') {
        const uRows = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, counterpartyId))
          .limit(1);
        if (uRows[0]) {
          counterpartyName = uRows[0].name;
          counterpartySlug = uRows[0].slug;
          counterpartySubtitle =
            [uRows[0].position, uRows[0].companyName].filter(Boolean).join(' · ') ||
            uRows[0].headline;
          counterpartyAvatarUrl = uRows[0].avatarUrl;
        }
      } else {
        const cRows = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.id, counterpartyId))
          .limit(1);
        if (cRows[0]) {
          counterpartyName = cRows[0].name;
          counterpartySlug = cRows[0].slug;
          counterpartySubtitle = [cRows[0].industry, cRows[0].headquarters]
            .filter(Boolean)
            .join(' · ');
          counterpartyAvatarUrl = cRows[0].logoUrl;
        }
      }

      // Directional access levels:
      // 1) counterpartyAccessToInbox: what access level does the counterparty have to THIS inbox?
      let counterpartyAccessToInbox: AccessLevelValue = ACCESS_LEVELS.GENERAL;
      let inboxAccessToCounterparty: AccessLevelValue = ACCESS_LEVELS.GENERAL;

      if (counterpartyType === 'user') {
        counterpartyAccessToInbox = await AccessService.getAccessLevel(
          db,
          counterpartyId,
          inboxTarget.type,
          inboxTarget.id
        );
        if (inboxTarget.type === 'user') {
          inboxAccessToCounterparty = await AccessService.getAccessLevel(
            db,
            inboxTarget.id,
            'user',
            counterpartyId
          );
        }
      } else {
        // Counterparty is a company (and inboxTarget is a user who messaged the company)
        inboxAccessToCounterparty = await AccessService.getAccessLevel(
          db,
          inboxTarget.id,
          'company',
          counterpartyId
        );
        // When a company replies to a user's inquiry, place in user's inbox according to user's access level with that company (or Recognized if >=2)
        counterpartyAccessToInbox =
          inboxAccessToCounterparty === ACCESS_LEVELS.BLOCKED
            ? ACCESS_LEVELS.BLOCKED
            : inboxAccessToCounterparty;
      }

      // Inspect messages in this conversation to determine inbound/outbound and unread count
      const msgRows = await db
        .select({
          id: schema.messages.id,
          senderUserId: schema.messages.senderUserId,
          sentAsCompanyId: schema.messages.sentAsCompanyId,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conv.id));

      let hasInbound = false;
      let hasOutbound = false;
      let unreadCount = 0;

      for (const m of msgRows) {
        const sentByThisInbox =
          inboxTarget.type === 'company'
            ? m.sentAsCompanyId === inboxTarget.id
            : m.senderUserId === inboxTarget.id && !m.sentAsCompanyId;

        if (sentByThisInbox) {
          hasOutbound = true;
        } else {
          hasInbound = true;
          if (!myLastReadAt || m.createdAt > myLastReadAt) {
            unreadCount++;
          }
        }
      }

      const isArchived = Boolean(myArchivedAt);

      const summary: ConversationSummary = {
        id: conv.id,
        subject: conv.subject,
        initiatorUserId: conv.initiatorUserId,
        recipientType: conv.recipientType as EntityType,
        recipientUserId: conv.recipientUserId,
        recipientCompanyId: conv.recipientCompanyId,
        counterparty: {
          type: counterpartyType,
          id: counterpartyId,
          slug: counterpartySlug,
          name: counterpartyName,
          subtitle: counterpartySubtitle,
          avatarUrl: counterpartyAvatarUrl,
        },
        counterpartyAccessToInbox,
        inboxAccessToCounterparty,
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: conv.lastMessagePreview,
        lastMessageSenderId: conv.lastMessageSenderId,
        unreadCount,
        isArchived,
        createdAt: conv.createdAt,
      };

      // Tally folder counts and unread counts (Blocked contacts are immediately excluded from inbox folders)
      if (isArchived) {
        folderCounts.archived++;
      } else {
        if (hasOutbound) {
          folderCounts.sent++;
        }
        if (hasInbound && counterpartyAccessToInbox !== ACCESS_LEVELS.BLOCKED) {
          if (counterpartyAccessToInbox === ACCESS_LEVELS.GENERAL) {
            folderCounts.general++;
            unreadCounts.general += unreadCount;
          } else if (counterpartyAccessToInbox === ACCESS_LEVELS.RECOGNIZED) {
            folderCounts.recognized++;
            unreadCounts.recognized += unreadCount;
          } else if (counterpartyAccessToInbox === ACCESS_LEVELS.DIRECT) {
            folderCounts.direct++;
            unreadCounts.direct += unreadCount;
          }
        }
      }

      enriched.push({ summary, hasInbound, hasOutbound });
    }

    const filtered = enriched
      .filter(({ summary, hasInbound, hasOutbound }) => {
        if (folder === 'archived') {
          return summary.isArchived;
        }
        if (summary.isArchived) {
          return false;
        }
        if (folder === 'sent') {
          return hasOutbound;
        }
        // For 'general', 'recognized', 'direct', must have at least one inbound message and not be blocked
        if (!hasInbound || summary.counterpartyAccessToInbox === ACCESS_LEVELS.BLOCKED) {
          return false;
        }
        if (folder === 'general') {
          return summary.counterpartyAccessToInbox === ACCESS_LEVELS.GENERAL;
        }
        if (folder === 'recognized') {
          return summary.counterpartyAccessToInbox === ACCESS_LEVELS.RECOGNIZED;
        }
        if (folder === 'direct') {
          return summary.counterpartyAccessToInbox === ACCESS_LEVELS.DIRECT;
        }
        return false;
      })
      .map((item) => item.summary);

    return {
      conversations: filtered,
      unreadCounts,
      folderCounts,
    };
  }

  /**
   * Retrieves a single conversation thread and its messages, verifying strict participant authorization
   * and marking inbound messages as read for the viewing side.
   */
  static async getConversationThread(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    conversationId: string,
    inboxTarget?: InboxTarget
  ): Promise<{
    conversation: ConversationSummary;
    messages: MessageItem[];
  }> {
    const convRows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    const conv = convRows[0];
    if (!conv) {
      throw new AccessControlError('Conversation not found.', 404);
    }

    // Verify actorUserId is a valid participant
    let viewingAsTarget: InboxTarget | null = null;

    if (inboxTarget && inboxTarget.type === 'company') {
      if (conv.recipientType === 'company' && conv.recipientCompanyId === inboxTarget.id) {
        await AccessService.assertCanManageInbox(db, actorUserId, 'company', inboxTarget.id);
        viewingAsTarget = inboxTarget;
      }
    }

    if (!viewingAsTarget) {
      if (conv.initiatorUserId === actorUserId) {
        viewingAsTarget = { type: 'user', id: actorUserId };
      } else if (conv.recipientType === 'user' && conv.recipientUserId === actorUserId) {
        viewingAsTarget = { type: 'user', id: actorUserId };
      } else if (conv.recipientType === 'company' && conv.recipientCompanyId) {
        const isAdmin = await AccessService.isCompanyInboxAdmin(
          db,
          actorUserId,
          conv.recipientCompanyId
        );
        if (isAdmin) {
          viewingAsTarget = { type: 'company', id: conv.recipientCompanyId };
        }
      }
    }

    if (!viewingAsTarget) {
      throw new AccessControlError(
        'You are not authorized to view this private conversation.',
        403
      );
    }

    const isInitiatorSide =
      viewingAsTarget.type === 'user' && conv.initiatorUserId === viewingAsTarget.id;

    // Mark as read for the viewing side
    const now = Date.now();
    await db
      .update(schema.conversations)
      .set(isInitiatorSide ? { initiatorLastReadAt: now } : { recipientLastReadAt: now })
      .where(eq(schema.conversations.id, conv.id));

    // Fetch messages joined with sender user details
    const rawMsgs = await db
      .select({
        id: schema.messages.id,
        conversationId: schema.messages.conversationId,
        senderUserId: schema.messages.senderUserId,
        senderName: schema.users.name,
        senderSlug: schema.users.slug,
        senderHeadline: schema.users.headline,
        senderAvatarUrl: schema.users.avatarUrl,
        sentAsCompanyId: schema.messages.sentAsCompanyId,
        body: schema.messages.body,
        createdAt: schema.messages.createdAt,
        readAt: schema.messages.readAt,
      })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.messages.senderUserId, schema.users.id))
      .where(eq(schema.messages.conversationId, conv.id))
      .orderBy(asc(schema.messages.createdAt));

    // Resolve company info if any message was sent as a company
    let companyMap = new Map<
      string,
      { name: string; slug: string; logoUrl: string | null }
    >();
    if (conv.recipientType === 'company' && conv.recipientCompanyId) {
      const cRows = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, conv.recipientCompanyId))
        .limit(1);
      if (cRows[0]) {
        companyMap.set(cRows[0].id, {
          name: cRows[0].name,
          slug: cRows[0].slug,
          logoUrl: cRows[0].logoUrl,
        });
      }
    }

    const messagesList: MessageItem[] = rawMsgs.map((m) => {
      const comp = m.sentAsCompanyId ? companyMap.get(m.sentAsCompanyId) : null;
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        senderName: m.senderName,
        senderSlug: m.senderSlug,
        senderHeadline: m.senderHeadline,
        senderAvatarUrl: m.senderAvatarUrl,
        sentAsCompanyId: m.sentAsCompanyId,
        sentAsCompanyName: comp?.name || null,
        sentAsCompanySlug: comp?.slug || null,
        sentAsCompanyLogoUrl: comp?.logoUrl || null,
        body: m.body,
        createdAt: m.createdAt,
        readAt: m.readAt,
      };
    });

    // Build ConversationSummary for the viewer
    let counterpartyType: EntityType;
    let counterpartyId: string;
    if (isInitiatorSide) {
      counterpartyType = conv.recipientType as EntityType;
      counterpartyId =
        conv.recipientType === 'user' ? conv.recipientUserId! : conv.recipientCompanyId!;
    } else {
      counterpartyType = 'user';
      counterpartyId = conv.initiatorUserId;
    }

    let counterpartyName = 'Unknown';
    let counterpartySlug = '';
    let counterpartySubtitle = '';
    let counterpartyAvatarUrl: string | null = null;

    if (counterpartyType === 'user') {
      const uRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, counterpartyId))
        .limit(1);
      if (uRows[0]) {
        counterpartyName = uRows[0].name;
        counterpartySlug = uRows[0].slug;
        counterpartySubtitle =
          [uRows[0].position, uRows[0].companyName].filter(Boolean).join(' · ') ||
          uRows[0].headline;
        counterpartyAvatarUrl = uRows[0].avatarUrl;
      }
    } else {
      const cRows = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, counterpartyId))
        .limit(1);
      if (cRows[0]) {
        counterpartyName = cRows[0].name;
        counterpartySlug = cRows[0].slug;
        counterpartySubtitle = [cRows[0].industry, cRows[0].headquarters]
          .filter(Boolean)
          .join(' · ');
        counterpartyAvatarUrl = cRows[0].logoUrl;
      }
    }

    let counterpartyAccessToInbox: AccessLevelValue = ACCESS_LEVELS.GENERAL;
    let inboxAccessToCounterparty: AccessLevelValue = ACCESS_LEVELS.GENERAL;

    if (counterpartyType === 'user') {
      counterpartyAccessToInbox = await AccessService.getAccessLevel(
        db,
        counterpartyId,
        viewingAsTarget.type,
        viewingAsTarget.id
      );
      if (viewingAsTarget.type === 'user') {
        inboxAccessToCounterparty = await AccessService.getAccessLevel(
          db,
          viewingAsTarget.id,
          'user',
          counterpartyId
        );
      }
    } else {
      inboxAccessToCounterparty = await AccessService.getAccessLevel(
        db,
        viewingAsTarget.id,
        'company',
        counterpartyId
      );
      counterpartyAccessToInbox = inboxAccessToCounterparty;
    }

    const summary: ConversationSummary = {
      id: conv.id,
      subject: conv.subject,
      initiatorUserId: conv.initiatorUserId,
      recipientType: conv.recipientType as EntityType,
      recipientUserId: conv.recipientUserId,
      recipientCompanyId: conv.recipientCompanyId,
      counterparty: {
        type: counterpartyType,
        id: counterpartyId,
        slug: counterpartySlug,
        name: counterpartyName,
        subtitle: counterpartySubtitle,
        avatarUrl: counterpartyAvatarUrl,
      },
      counterpartyAccessToInbox,
      inboxAccessToCounterparty,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      lastMessageSenderId: conv.lastMessageSenderId,
      unreadCount: 0,
      isArchived: Boolean(
        isInitiatorSide ? conv.initiatorArchivedAt : conv.recipientArchivedAt
      ),
      createdAt: conv.createdAt,
    };

    return { conversation: summary, messages: messagesList };
  }

  /**
   * Archives or unarchives a conversation for the viewing participant side.
   */
  static async setConversationArchived(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    conversationId: string,
    archived: boolean,
    inboxTarget?: InboxTarget
  ): Promise<void> {
    const convRows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    const conv = convRows[0];
    if (!conv) {
      throw new AccessControlError('Conversation not found.', 404);
    }

    let isInitiatorSide = false;
    if (inboxTarget?.type === 'company' && conv.recipientCompanyId === inboxTarget.id) {
      await AccessService.assertCanManageInbox(db, actorUserId, 'company', inboxTarget.id);
      isInitiatorSide = false;
    } else if (conv.initiatorUserId === actorUserId) {
      isInitiatorSide = true;
    } else if (conv.recipientType === 'user' && conv.recipientUserId === actorUserId) {
      isInitiatorSide = false;
    } else if (conv.recipientType === 'company' && conv.recipientCompanyId) {
      const isAdmin = await AccessService.isCompanyInboxAdmin(
        db,
        actorUserId,
        conv.recipientCompanyId
      );
      if (!isAdmin) {
        throw new AccessControlError('Unauthorized.', 403);
      }
      isInitiatorSide = false;
    } else {
      throw new AccessControlError('Unauthorized.', 403);
    }

    const val = archived ? Date.now() : null;
    await db
      .update(schema.conversations)
      .set(isInitiatorSide ? { initiatorArchivedAt: val } : { recipientArchivedAt: val })
      .where(eq(schema.conversations.id, conversationId));
  }
}

