import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-db-helper';
import * as schema from '../src/server/db/schema';
import { AccessService } from '../src/server/services/access.service';
import { MessageService } from '../src/server/services/message.service';
import { ACCESS_LEVELS } from '../src/shared/constants';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

describe('Mobilikey Three-Level Messaging Access & Authorization Suite', () => {
  let db: DrizzleD1Database<typeof schema>;

  const now = Date.now();
  const userJohn = { id: 'usr_john', slug: 'john-miller', email: 'john@example.com', name: 'John Miller' };
  const userSarah = { id: 'usr_sarah', slug: 'sarah-chen', email: 'sarah@example.com', name: 'Sarah Chen' };
  const userDavid = { id: 'usr_david', slug: 'david-park', email: 'david@example.com', name: 'David Park' };
  const userPublisher = { id: 'usr_pub', slug: 'elena-rostova', email: 'elena@example.com', name: 'Elena Rostova' };

  const companyAcme = { id: 'cmp_acme', slug: 'acme-capital', name: 'Acme Capital Partners' };

  beforeEach(async () => {
    const ctx = createTestDb();
    db = ctx.db;

    for (const u of [userJohn, userSarah, userDavid, userPublisher]) {
      await db.insert(schema.users).values({
        id: u.id,
        slug: u.slug,
        email: u.email,
        passwordHash: 'hash',
        name: u.name,
        headline: 'Principal',
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(schema.companies).values({
      id: companyAcme.id,
      slug: companyAcme.slug,
      name: companyAcme.name,
      description: 'Institutional Asset Management',
      industry: 'Financial Services',
      headquarters: 'New York, NY',
      companySize: '51-200 employees',
      createdAt: now,
      updatedAt: now,
    });

    // Sarah is an Owner/Admin of Acme Capital; Elena is only a Publisher
    await db.insert(schema.companyMembers).values([
      {
        id: 'cm_1',
        companyId: companyAcme.id,
        userId: userSarah.id,
        role: 'owner',
        createdAt: now,
      },
      {
        id: 'cm_2',
        companyId: companyAcme.id,
        userId: userPublisher.id,
        role: 'publisher',
        createdAt: now,
      },
    ]);
  });

  it('1. Access is independent for every recipient (no universal access score)', async () => {
    // Default access is Level 1 (General)
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userSarah.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userDavid.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );

    // Sarah grants John Level 3 Direct Access
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.DIRECT,
    });

    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userSarah.id)).toBe(
      ACCESS_LEVELS.DIRECT
    );
    // John still only has Level 1 General Access to David and to Acme Capital
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userDavid.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'company', companyAcme.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );
  });

  it('2. Access is strictly directional (John -> Sarah does not grant Sarah -> John)', async () => {
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.DIRECT,
    });

    // John has Level 3 to Sarah, while Sarah still has Level 1 to John
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userSarah.id)).toBe(
      ACCESS_LEVELS.DIRECT
    );
    expect(await AccessService.getAccessLevel(db, userSarah.id, 'user', userJohn.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );
  });

  it('3. A recipient reply does NOT automatically promote the sender', async () => {
    // John sends Level 1 message to Sarah
    const { conversationId } = await MessageService.startConversation(db, {
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      subject: 'Partnership Inquiry',
      body: 'Hello Sarah, I would like to discuss our Q4 infrastructure procurement.',
    });

    // Verify it appears in Sarah's General Requests (Level 1) inbox
    const sarahGeneralBefore = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'general'
    );
    expect(sarahGeneralBefore.conversations).toHaveLength(1);

    // Sarah replies to John
    await MessageService.replyToConversation(db, {
      actorUserId: userSarah.id,
      conversationId,
      body: 'Thanks John, please send over the specification summary.',
    });

    // John's access to Sarah MUST remain Level 1 (General Access)
    const johnAccessAfterReply = await AccessService.getAccessLevel(
      db,
      userJohn.id,
      'user',
      userSarah.id
    );
    expect(johnAccessAfterReply).toBe(ACCESS_LEVELS.GENERAL);

    // Conversation remains in Sarah's General Requests inbox, not Recognized or Direct
    const sarahRecognized = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'recognized'
    );
    expect(sarahRecognized.conversations).toHaveLength(0);
  });

  it('4. Users cannot promote themselves (self-promotion is blocked)', async () => {
    // John tries to promote himself to Sarah's inbox
    await expect(
      AccessService.setAccessLevel(db, {
        actorUserId: userJohn.id,
        senderUserId: userJohn.id,
        recipientType: 'user',
        recipientId: userSarah.id,
        accessLevel: ACCESS_LEVELS.DIRECT,
      })
    ).rejects.toThrow(/cannot modify their own/i);

    // Sarah (even as owner of Acme Capital) tries to promote herself to Acme Capital
    await expect(
      AccessService.setAccessLevel(db, {
        actorUserId: userSarah.id,
        senderUserId: userSarah.id,
        recipientType: 'company',
        recipientId: companyAcme.id,
        accessLevel: ACCESS_LEVELS.DIRECT,
      })
    ).rejects.toThrow(/cannot modify their own/i);

    // John tries to promote David in Sarah's inbox
    await expect(
      AccessService.setAccessLevel(db, {
        actorUserId: userJohn.id,
        senderUserId: userDavid.id,
        recipientType: 'user',
        recipientId: userSarah.id,
        accessLevel: ACCESS_LEVELS.RECOGNIZED,
      })
    ).rejects.toThrow(/not authorized/i);
  });

  it('5. Users cannot access another person’s messages or inbox', async () => {
    const { conversationId } = await MessageService.startConversation(db, {
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      body: 'Confidential term sheet details.',
    });

    // David cannot list Sarah's inbox
    await expect(
      MessageService.listInbox(db, userDavid.id, { type: 'user', id: userSarah.id }, 'general')
    ).rejects.toThrow(/not authorized/i);

    // David cannot read the conversation thread between John and Sarah
    await expect(
      MessageService.getConversationThread(db, userDavid.id, conversationId)
    ).rejects.toThrow(/not authorized/i);

    // David cannot reply to the conversation between John and Sarah
    await expect(
      MessageService.replyToConversation(db, {
        actorUserId: userDavid.id,
        conversationId,
        body: 'Intruder message',
      })
    ).rejects.toThrow(/permission/i);
  });

  it('6. Company administrators only access authorized company inboxes; company access does not leak to personal inboxes', async () => {
    const { conversationId } = await MessageService.startConversation(db, {
      senderUserId: userJohn.id,
      recipientType: 'company',
      recipientId: companyAcme.id,
      body: 'Inquiry for Acme Capital.',
    });

    // Sarah (owner) can access Acme Capital inbox
    const acmeGeneral = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'company', id: companyAcme.id },
      'general'
    );
    expect(acmeGeneral.conversations).toHaveLength(1);

    // David (non-member) and Elena (publisher-only, not inbox admin) CANNOT access Acme Capital inbox
    await expect(
      MessageService.listInbox(
        db,
        userDavid.id,
        { type: 'company', id: companyAcme.id },
        'general'
      )
    ).rejects.toThrow(/not an authorized administrator/i);

    await expect(
      MessageService.listInbox(
        db,
        userPublisher.id,
        { type: 'company', id: companyAcme.id },
        'general'
      )
    ).rejects.toThrow(/not an authorized administrator/i);

    // Sarah grants John Level 3 Direct Access to Acme Capital's inbox
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'company',
      recipientId: companyAcme.id,
      accessLevel: ACCESS_LEVELS.DIRECT,
    });

    // John now has Level 3 to Acme Capital, but still only Level 1 to Sarah's personal inbox!
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'company', companyAcme.id)).toBe(
      ACCESS_LEVELS.DIRECT
    );
    expect(await AccessService.getAccessLevel(db, userJohn.id, 'user', userSarah.id)).toBe(
      ACCESS_LEVELS.GENERAL
    );

    // Conversation is now in Acme Capital's Direct folder
    const acmeDirect = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'company', id: companyAcme.id },
      'direct'
    );
    expect(acmeDirect.conversations).toHaveLength(1);
    expect(acmeDirect.conversations[0].id).toBe(conversationId);
  });

  it('7. Blocking overrides all access levels immediately', async () => {
    // Sarah grants John Level 3 Direct Access
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.DIRECT,
    });

    const { conversationId } = await MessageService.startConversation(db, {
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      body: 'Initial direct message.',
    });

    // Sarah blocks John (accessLevel = 0)
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.BLOCKED,
    });

    // Conversation immediately disappears from Sarah's Direct, Recognized, and General inboxes
    const sarahDirect = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'direct'
    );
    expect(sarahDirect.conversations).toHaveLength(0);

    // John cannot send a new message or reply in the existing conversation
    await expect(
      MessageService.startConversation(db, {
        senderUserId: userJohn.id,
        recipientType: 'user',
        recipientId: userSarah.id,
        body: 'Blocked attempt',
      })
    ).rejects.toThrow(/unable to send messages/i);

    await expect(
      MessageService.replyToConversation(db, {
        actorUserId: userJohn.id,
        conversationId,
        body: 'Blocked reply attempt',
      })
    ).rejects.toThrow(/blocked/i);
  });

  it('8. Promoting and downgrading access takes effect immediately across inbox views', async () => {
    await MessageService.startConversation(db, {
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      body: 'Hello Sarah',
    });

    // Initially in General (L1)
    let inbox = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'general'
    );
    expect(inbox.folderCounts.general).toBe(1);
    expect(inbox.folderCounts.recognized).toBe(0);
    expect(inbox.folderCounts.direct).toBe(0);

    // Promote to Level 2 (Recognized)
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.RECOGNIZED,
    });

    inbox = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'recognized'
    );
    expect(inbox.folderCounts.general).toBe(0);
    expect(inbox.folderCounts.recognized).toBe(1);
    expect(inbox.conversations).toHaveLength(1);

    // Promote to Level 3 (Direct)
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.DIRECT,
    });

    inbox = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'direct'
    );
    expect(inbox.folderCounts.recognized).toBe(0);
    expect(inbox.folderCounts.direct).toBe(1);
    expect(inbox.conversations).toHaveLength(1);

    // Downgrade back to Level 1 (General)
    await AccessService.setAccessLevel(db, {
      actorUserId: userSarah.id,
      senderUserId: userJohn.id,
      recipientType: 'user',
      recipientId: userSarah.id,
      accessLevel: ACCESS_LEVELS.GENERAL,
    });

    inbox = await MessageService.listInbox(
      db,
      userSarah.id,
      { type: 'user', id: userSarah.id },
      'general'
    );
    expect(inbox.folderCounts.direct).toBe(0);
    expect(inbox.folderCounts.general).toBe(1);
    expect(inbox.conversations).toHaveLength(1);
  });
});

