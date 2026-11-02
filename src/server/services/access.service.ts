import { and, eq, ne } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  type AccessLevelValue,
} from '../../shared/constants';
import type { AccessPermissionRecord, EntityType } from '../../shared/types';
import { generateId } from './auth.service';

export class AccessControlError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AccessControlError';
    this.statusCode = statusCode;
  }
}

export class AccessService {
  /**
   * Verifies whether actorUserId is an authorized administrator ('owner' or 'admin')
   * for a given company inbox. Publishers ('publisher') cannot read or manage company inboxes.
   */
  static async isCompanyInboxAdmin(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    companyId: string
  ): Promise<boolean> {
    const rows = await db
      .select({ role: schema.companyMembers.role })
      .from(schema.companyMembers)
      .where(
        and(
          eq(schema.companyMembers.companyId, companyId),
          eq(schema.companyMembers.userId, actorUserId)
        )
      )
      .limit(1);

    const role = rows[0]?.role;
    return role === 'owner' || role === 'admin';
  }

  /**
   * Asserts that actorUserId is authorized to view/manage the target inbox (personal or company).
   */
  static async assertCanManageInbox(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    recipientType: EntityType,
    recipientId: string
  ): Promise<void> {
    if (recipientType === 'user') {
      if (actorUserId !== recipientId) {
        throw new AccessControlError(
          'You are not authorized to access or manage another user’s personal inbox.',
          403
        );
      }
      return;
    }

    if (recipientType === 'company') {
      const isAdmin = await this.isCompanyInboxAdmin(db, actorUserId, recipientId);
      if (!isAdmin) {
        throw new AccessControlError(
          'You are not an authorized administrator for this company inbox.',
          403
        );
      }
      return;
    }

    throw new AccessControlError('Invalid recipient type.', 400);
  }

  /**
   * Returns the directional access level that senderUserId holds toward (recipientType, recipientId).
   * Defaults to Level 1 (General Access) if no explicit permission record exists.
   * Note: Company inbox permissions and personal inbox permissions are strictly isolated.
   */
  static async getAccessLevel(
    db: DrizzleD1Database<typeof schema>,
    senderUserId: string,
    recipientType: EntityType,
    recipientId: string
  ): Promise<AccessLevelValue> {
    const condition =
      recipientType === 'user'
        ? and(
            eq(schema.accessPermissions.senderUserId, senderUserId),
            eq(schema.accessPermissions.recipientType, 'user'),
            eq(schema.accessPermissions.recipientUserId, recipientId)
          )
        : and(
            eq(schema.accessPermissions.senderUserId, senderUserId),
            eq(schema.accessPermissions.recipientType, 'company'),
            eq(schema.accessPermissions.recipientCompanyId, recipientId)
          );

    const rows = await db
      .select({ accessLevel: schema.accessPermissions.accessLevel })
      .from(schema.accessPermissions)
      .where(condition)
      .limit(1);

    if (!rows[0]) {
      return ACCESS_LEVELS.GENERAL;
    }
    return rows[0].accessLevel as AccessLevelValue;
  }

  /**
   * Sets the directional access level that senderUserId holds toward (recipientType, recipientId).
   * Enforces:
   * 1. Actor must own the recipient personal inbox OR be an owner/admin of the recipient company inbox.
   * 2. Users cannot promote or modify their own access level (self-promotion is forbidden).
   * 3. Changes take effect immediately and record an audit log + professional notification when appropriate.
   */
  static async setAccessLevel(
    db: DrizzleD1Database<typeof schema>,
    params: {
      actorUserId: string;
      senderUserId: string;
      recipientType: EntityType;
      recipientId: string;
      accessLevel: AccessLevelValue;
    }
  ): Promise<{ previousLevel: AccessLevelValue; newLevel: AccessLevelValue }> {
    const { actorUserId, senderUserId, recipientType, recipientId, accessLevel } = params;

    if (![0, 1, 2, 3].includes(accessLevel)) {
      throw new AccessControlError('Invalid access level. Must be 0, 1, 2, or 3.', 400);
    }

    // Rule: Users cannot promote or change their own access level
    if (actorUserId === senderUserId) {
      throw new AccessControlError('Users cannot modify their own messaging access level.', 403);
    }

    if (recipientType === 'user' && senderUserId === recipientId) {
      throw new AccessControlError('Cannot set messaging access level toward oneself.', 400);
    }

    // Rule: Actor must be authorized for the target recipient inbox
    await this.assertCanManageInbox(db, actorUserId, recipientType, recipientId);

    // Verify senderUser exists
    const senderRows = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, senderUserId))
      .limit(1);
    if (!senderRows[0]) {
      throw new AccessControlError('Target sender user does not exist.', 404);
    }

    // Verify recipient exists and get display name for notification
    let recipientDisplayName = '';
    if (recipientType === 'user') {
      const recUser = await db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, recipientId))
        .limit(1);
      if (!recUser[0]) {
        throw new AccessControlError('Recipient user not found.', 404);
      }
      recipientDisplayName = recUser[0].name;
    } else {
      const recComp = await db
        .select({ id: schema.companies.id, name: schema.companies.name })
        .from(schema.companies)
        .where(eq(schema.companies.id, recipientId))
        .limit(1);
      if (!recComp[0]) {
        throw new AccessControlError('Recipient company not found.', 404);
      }
      recipientDisplayName = recComp[0].name;
    }

    const now = Date.now();
    const condition =
      recipientType === 'user'
        ? and(
            eq(schema.accessPermissions.senderUserId, senderUserId),
            eq(schema.accessPermissions.recipientType, 'user'),
            eq(schema.accessPermissions.recipientUserId, recipientId)
          )
        : and(
            eq(schema.accessPermissions.senderUserId, senderUserId),
            eq(schema.accessPermissions.recipientType, 'company'),
            eq(schema.accessPermissions.recipientCompanyId, recipientId)
          );

    const existing = await db
      .select()
      .from(schema.accessPermissions)
      .where(condition)
      .limit(1);

    const previousLevel: AccessLevelValue = existing[0]
      ? (existing[0].accessLevel as AccessLevelValue)
      : ACCESS_LEVELS.GENERAL;

    if (!existing[0]) {
      await db.insert(schema.accessPermissions).values({
        id: generateId('acc'),
        senderUserId,
        recipientType,
        recipientUserId: recipientType === 'user' ? recipientId : null,
        recipientCompanyId: recipientType === 'company' ? recipientId : null,
        accessLevel,
        grantedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(schema.accessPermissions)
        .set({
          accessLevel,
          grantedByUserId: actorUserId,
          updatedAt: now,
        })
        .where(eq(schema.accessPermissions.id, existing[0].id));
    }

    // Record audit log
    await db.insert(schema.auditLogs).values({
      id: generateId('aud'),
      actorUserId,
      action: `access_level_changed_${previousLevel}_to_${accessLevel}`,
      targetType: recipientType,
      targetId: `${recipientId}:${senderUserId}`,
      metadataJson: JSON.stringify({
        senderUserId,
        recipientType,
        recipientId,
        previousLevel,
        newLevel: accessLevel,
      }),
      createdAt: now,
    });

    // Professional, non-gamified notifications for promotions and downgrades (excluding blocks)
    if (previousLevel !== accessLevel && accessLevel > 0) {
      if (accessLevel > previousLevel) {
        const levelLabel =
          accessLevel === ACCESS_LEVELS.DIRECT ? 'Direct Access' : 'Recognized Access';
        await db.insert(schema.notifications).values({
          id: generateId('ntf'),
          userId: senderUserId,
          type: 'access_promoted',
          title: `You now have ${levelLabel} to ${recipientDisplayName}.`,
          body: `Your messages to ${recipientDisplayName} will now appear in their ${
            accessLevel === ACCESS_LEVELS.DIRECT ? 'Direct priority' : 'Recognized'
          } inbox.`,
          referenceType: recipientType,
          referenceId: recipientId,
          createdAt: now,
        });
      } else if (previousLevel > 1 && accessLevel < previousLevel) {
        await db.insert(schema.notifications).values({
          id: generateId('ntf'),
          userId: senderUserId,
          type: 'access_downgraded',
          title: `Your messaging access to ${recipientDisplayName} was updated.`,
          body: `Your current access level to ${recipientDisplayName} is ${ACCESS_LEVEL_LABELS[accessLevel]}.`,
          referenceType: recipientType,
          referenceId: recipientId,
          createdAt: now,
        });
      }
    }

    return { previousLevel, newLevel: accessLevel };
  }

  /**
   * Lists explicit access permissions configured for a recipient inbox (personal or company).
   */
  static async listPermissionsForRecipient(
    db: DrizzleD1Database<typeof schema>,
    actorUserId: string,
    recipientType: EntityType,
    recipientId: string
  ): Promise<AccessPermissionRecord[]> {
    await this.assertCanManageInbox(db, actorUserId, recipientType, recipientId);

    const condition =
      recipientType === 'user'
        ? and(
            eq(schema.accessPermissions.recipientType, 'user'),
            eq(schema.accessPermissions.recipientUserId, recipientId)
          )
        : and(
            eq(schema.accessPermissions.recipientType, 'company'),
            eq(schema.accessPermissions.recipientCompanyId, recipientId)
          );

    const rows = await db
      .select({
        id: schema.accessPermissions.id,
        senderUserId: schema.accessPermissions.senderUserId,
        senderName: schema.users.name,
        senderSlug: schema.users.slug,
        senderHeadline: schema.users.headline,
        senderCompany: schema.users.companyName,
        senderAvatarUrl: schema.users.avatarUrl,
        recipientType: schema.accessPermissions.recipientType,
        accessLevel: schema.accessPermissions.accessLevel,
        grantedByUserId: schema.accessPermissions.grantedByUserId,
        updatedAt: schema.accessPermissions.updatedAt,
      })
      .from(schema.accessPermissions)
      .innerJoin(schema.users, eq(schema.accessPermissions.senderUserId, schema.users.id))
      .where(condition);

    return rows
      .map((r) => ({
        id: r.id,
        senderUserId: r.senderUserId,
        senderName: r.senderName,
        senderSlug: r.senderSlug,
        senderHeadline: r.senderHeadline,
        senderCompany: r.senderCompany,
        senderAvatarUrl: r.senderAvatarUrl,
        recipientType: r.recipientType as EntityType,
        recipientId,
        accessLevel: r.accessLevel as AccessLevelValue,
        grantedByUserId: r.grantedByUserId,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

