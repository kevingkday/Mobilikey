-- Mobilikey Local Development Seed Data
-- Default password for all seeded accounts: Mobilikey2026!

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (
  id, slug, email, password_hash, email_verified_at, name, headline, biography, location,
  company_name, position, website, industry, social_links_json, avatar_url,
  is_public, allow_level1_messages, system_role, status, created_at, updated_at
) VALUES
  (
    'usr_sarah',
    'sarah-chen',
    'sarah.chen@northstar-infra.com',
    'pbkdf2_sha256$100000$07070707070707070707070707070707$3f382d17cee8c56cdadc37b7476c18cf9244c363f7efa99bc411500d20b6d15d',
    1761900000000,
    'Sarah Chen',
    'Managing Partner — North American Grid & Infrastructure Debt',
    'Managing Partner at Northstar Infrastructure Partners overseeing institutional infrastructure debt, utility modernization, and grid storage transactions across North America.',
    'New York, NY',
    'Northstar Infrastructure Partners',
    'Managing Partner',
    'https://northstar-infra.example.com',
    'Financial Services',
    '{}',
    NULL,
    1,
    1,
    'admin',
    'active',
    1761900000000,
    1761900000000
  ),
  (
    'usr_john',
    'john-miller',
    'john.miller@vanguard-logistics.com',
    'pbkdf2_sha256$100000$07070707070707070707070707070707$3f382d17cee8c56cdadc37b7476c18cf9244c363f7efa99bc411500d20b6d15d',
    1761900000000,
    'John Miller',
    'VP of Global Freight & Intermodal Operations',
    'Overseeing port terminal automation, cold-chain rail corridors, and enterprise carrier procurement at Vanguard Global Logistics.',
    'Chicago, IL',
    'Vanguard Global Logistics',
    'VP Supply Chain',
    'https://vanguard-logistics.example.com',
    'Logistics & Transportation',
    '{}',
    NULL,
    1,
    1,
    'user',
    'active',
    1761901000000,
    1761901000000
  ),
  (
    'usr_elena',
    'elena-rostova',
    'elena.rostova@helion-bio.com',
    'pbkdf2_sha256$100000$07070707070707070707070707070707$3f382d17cee8c56cdadc37b7476c18cf9244c363f7efa99bc411500d20b6d15d',
    1761900000000,
    'Dr. Elena Rostova',
    'Chief Scientific Officer — Targeted Biologics & GMP Manufacturing',
    'Leading clinical-stage antibody engineering and commercial GMP fill-finish partnerships at Helion Biotherapeutics.',
    'Boston, MA',
    'Helion Biotherapeutics',
    'Chief Scientific Officer',
    'https://helion-bio.example.com',
    'Biotechnology & Healthcare',
    '{}',
    NULL,
    1,
    1,
    'user',
    'active',
    1761902000000,
    1761902000000
  ),
  (
    'usr_marcus',
    'marcus-vance',
    'marcus@vance-advisory.com',
    'pbkdf2_sha256$100000$07070707070707070707070707070707$3f382d17cee8c56cdadc37b7476c18cf9244c363f7efa99bc411500d20b6d15d',
    1761900000000,
    'Marcus Vance',
    'Principal Regulatory Counsel & Cross-Border M&A Advisor',
    'Independent regulatory advisor specializing in energy transmission filings and industrial cross-border acquisitions.',
    'Washington, DC',
    'Vance Advisory Group',
    'Principal',
    'https://vance-advisory.example.com',
    'Legal & Compliance',
    '{}',
    NULL,
    1,
    1,
    'user',
    'active',
    1761903000000,
    1761903000000
  ),
  (
    'usr_claire',
    'claire-dubois',
    'claire.dubois@aegis-cyber.com',
    'pbkdf2_sha256$100000$07070707070707070707070707070707$3f382d17cee8c56cdadc37b7476c18cf9244c363f7efa99bc411500d20b6d15d',
    1761900000000,
    'Claire Dubois',
    'Director of Industrial OT Security & Critical Infrastructure',
    'Securing SCADA systems, power generation facilities, and maritime logistics networks.',
    'Austin, TX',
    'Aegis Industrial Security',
    'Director of Engineering',
    'https://aegis-cyber.example.com',
    'Cybersecurity',
    '{}',
    NULL,
    1,
    1,
    'user',
    'active',
    1761904000000,
    1761904000000
  );

INSERT OR IGNORE INTO companies (
  id, slug, name, logo_url, description, website, industry, headquarters, company_size, contact_info, status, created_at, updated_at
) VALUES
  (
    'cmp_northstar',
    'northstar-infrastructure-partners',
    'Northstar Infrastructure Partners',
    NULL,
    'Institutional infrastructure investment and project finance firm focused on power transmission, utility-scale storage, and freight rail terminals.',
    'https://northstar-infra.example.com',
    'Financial Services',
    'New York, NY',
    '51-200 employees',
    'Institutional Desk · 520 Madison Ave, New York, NY',
    'active',
    1761900000000,
    1761900000000
  ),
  (
    'cmp_vanguard',
    'vanguard-global-logistics',
    'Vanguard Global Logistics',
    NULL,
    'North American intermodal freight operator, temperature-controlled warehousing provider, and port terminal logistics integrator.',
    'https://vanguard-logistics.example.com',
    'Logistics & Transportation',
    'Chicago, IL',
    '1,000+ employees',
    'Enterprise Operations · Chicago, IL',
    'active',
    1761901000000,
    1761901000000
  ),
  (
    'cmp_helion',
    'helion-biotherapeutics',
    'Helion Biotherapeutics',
    NULL,
    'Clinical-stage biotechnology organization developing targeted antibody-drug conjugates and operating GMP biologics manufacturing in Massachusetts.',
    'https://helion-bio.example.com',
    'Biotechnology & Healthcare',
    'Boston, MA',
    '201-1,000 employees',
    'Clinical & CDMO Partnerships · Kendall Square, Cambridge, MA',
    'active',
    1761902000000,
    1761902000000
  ),
  (
    'cmp_vance',
    'vance-advisory-group',
    'Vance Advisory Group',
    NULL,
    'Independent regulatory law and strategic transaction advisory practice serving energy utilities and industrial operators.',
    'https://vance-advisory.example.com',
    'Legal & Compliance',
    'Washington, DC',
    '1 (Solo Principal)',
    'Direct Principal Practice · Washington, DC',
    'active',
    1761903000000,
    1761903000000
  );

INSERT OR IGNORE INTO company_members (id, company_id, user_id, role, created_at) VALUES
  ('cm_ns_1', 'cmp_northstar', 'usr_sarah', 'owner', 1761900000000),
  ('cm_vg_1', 'cmp_vanguard', 'usr_john', 'owner', 1761901000000),
  ('cm_hl_1', 'cmp_helion', 'usr_elena', 'owner', 1761902000000),
  ('cm_va_1', 'cmp_vance', 'usr_marcus', 'owner', 1761903000000);

-- Directional Access Permissions
-- 1. Sarah granted John Level 3 Direct Access (while John granted Sarah Level 2 Recognized Access -> demonstrates directionality!)
-- 2. Sarah granted Marcus Level 2 Recognized Access
-- 3. Elena has default Level 1 General Access to Sarah
-- 4. John has Level 3 Direct Access to Northstar Infrastructure Partners company inbox
INSERT OR IGNORE INTO access_permissions (
  id, sender_user_id, recipient_type, recipient_user_id, recipient_company_id, access_level, granted_by_user_id, created_at, updated_at
) VALUES
  ('acc_1', 'usr_john', 'user', 'usr_sarah', NULL, 3, 'usr_sarah', 1761910000000, 1761910000000),
  ('acc_2', 'usr_sarah', 'user', 'usr_john', NULL, 2, 'usr_john', 1761910000000, 1761910000000),
  ('acc_3', 'usr_marcus', 'user', 'usr_sarah', NULL, 2, 'usr_sarah', 1761915000000, 1761915000000),
  ('acc_4', 'usr_john', 'company', NULL, 'cmp_northstar', 3, 'usr_sarah', 1761920000000, 1761920000000);

-- Seeded Conversations across Level 3 (Direct), Level 2 (Recognized), and Level 1 (General Requests)
INSERT OR IGNORE INTO conversations (
  id, subject, initiator_user_id, recipient_type, recipient_user_id, recipient_company_id,
  last_message_at, last_message_preview, last_message_sender_id,
  initiator_last_read_at, recipient_last_read_at, created_at, updated_at
) VALUES
  (
    'cnv_direct_1',
    'Midwest Intermodal Terminal Co-Investment Term Sheet',
    'usr_john',
    'user',
    'usr_sarah',
    NULL,
    1761950000000,
    'Confirmed. Our engineering team completed the Joliet rail siding capacity audit this morning.',
    'usr_john',
    1761950000000,
    1761940000000,
    1761930000000,
    1761950000000
  ),
  (
    'cnv_rec_1',
    'FERC Order 2023 Interconnection Filing Review',
    'usr_marcus',
    'user',
    'usr_sarah',
    NULL,
    1761948000000,
    'I have attached the redlined interconnection docket schedule for the Pennsylvania substation.',
    'usr_marcus',
    1761948000000,
    1761945000000,
    1761935000000,
    1761948000000
  ),
  (
    'cnv_gen_1',
    'SCADA Telemetry Security Assessment Inquiry',
    'usr_claire',
    'user',
    'usr_sarah',
    NULL,
    1761949000000,
    'Hello Sarah, Aegis recently completed NERC CIP compliance audits for three regional transmission operators and would welcome a brief introduction.',
    'usr_claire',
    1761949000000,
    NULL,
    1761949000000,
    1761949000000
  ),
  (
    'cnv_comp_1',
    'Cold-Chain Facility Financing Proposal',
    'usr_elena',
    'company',
    NULL,
    'cmp_northstar',
    1761951000000,
    'Helion is expanding our Waltham GMP cold-storage facility in Q1 and seeking institutional facility financing.',
    'usr_elena',
    1761951000000,
    NULL,
    1761951000000,
    1761951000000
  );

INSERT OR IGNORE INTO messages (
  id, conversation_id, sender_user_id, sent_as_company_id, body, created_at, read_at
) VALUES
  (
    'msg_1',
    'cnv_direct_1',
    'usr_john',
    NULL,
    'Sarah, following our call on Tuesday, we have finalized the throughput projections for the Joliet intermodal expansion.',
    1761930000000,
    1761940000000
  ),
  (
    'msg_2',
    'cnv_direct_1',
    'usr_sarah',
    NULL,
    'Thank you John. Our credit committee reviewed the initial summary and requested confirmation on the rail siding capacity audit.',
    1761940000000,
    1761945000000
  ),
  (
    'msg_3',
    'cnv_direct_1',
    'usr_john',
    NULL,
    'Confirmed. Our engineering team completed the Joliet rail siding capacity audit this morning.',
    1761950000000,
    NULL
  ),
  (
    'msg_4',
    'cnv_rec_1',
    'usr_marcus',
    NULL,
    'I have attached the redlined interconnection docket schedule for the Pennsylvania substation.',
    1761948000000,
    NULL
  ),
  (
    'msg_5',
    'cnv_gen_1',
    'usr_claire',
    NULL,
    'Hello Sarah, Aegis recently completed NERC CIP compliance audits for three regional transmission operators and would welcome a brief introduction.',
    1761949000000,
    NULL
  ),
  (
    'msg_6',
    'cnv_comp_1',
    'usr_elena',
    NULL,
    'Helion is expanding our Waltham GMP cold-storage facility in Q1 and seeking institutional facility financing.',
    1761951000000,
    NULL
  );

-- Seeded Factual 500-Character Company Announcements
INSERT OR IGNORE INTO announcements (
  id, company_id, author_user_id, category_id, body, external_url, moderation_status, created_at
) VALUES
  (
    'ann_1',
    'cmp_northstar',
    'usr_sarah',
    'cat_funding',
    'Northstar Infrastructure Partners has closed Northstar Grid & Storage Fund IV at $1.45 billion in institutional commitments to finance utility-scale battery storage and high-voltage transmission upgrades across PJM and ERCOT.',
    'https://northstar-infra.example.com/releases/fund-iv-close',
    'published',
    1761952000000
  ),
  (
    'ann_2',
    'cmp_vanguard',
    'usr_john',
    'cat_expansion',
    'Vanguard Global Logistics has commissioned a 420,000 sq. ft. automated cold-chain intermodal distribution facility in Joliet, Illinois, adding 60 daily refrigerated rail car slots connecting Midwest producers to East Coast ports.',
    'https://vanguard-logistics.example.com/news/joliet-terminal',
    'published',
    1761950000000
  ),
  (
    'ann_3',
    'cmp_helion',
    'usr_elena',
    'cat_milestones',
    'Helion Biotherapeutics has completed FDA Phase II enrollment for HLN-204 and commissioned its second commercial-scale 2,000L single-use bioreactor suite at our Waltham, Massachusetts GMP manufacturing facility.',
    'https://helion-bio.example.com/updates/hln-204-phase2',
    'published',
    1761948000000
  ),
  (
    'ann_4',
    'cmp_vance',
    'usr_marcus',
    'cat_contracts',
    'Vance Advisory Group has been retained as lead FERC regulatory counsel for the 345kV Mid-Atlantic Multi-State Transmission Corridor project.',
    NULL,
    'published',
    1761945000000
  ),
  (
    'ann_5',
    'cmp_vanguard',
    'usr_john',
    'cat_hiring',
    'Vanguard Global Logistics is hiring a Principal Systems Architect (Terminal Telemetry & Rail Dispatch) in Chicago, IL. Direct experience with high-availability distributed telemetry required.',
    'https://vanguard-logistics.example.com/careers/principal-architect',
    'published',
    1761942000000
  );

INSERT OR IGNORE INTO follows (
  id, follower_user_id, target_type, target_user_id, target_company_id, created_at
) VALUES
  ('flw_1', 'usr_sarah', 'company', NULL, 'cmp_vanguard', 1761910000000),
  ('flw_2', 'usr_sarah', 'company', NULL, 'cmp_helion', 1761910000000),
  ('flw_3', 'usr_sarah', 'user', 'usr_john', NULL, 1761910000000),
  ('flw_4', 'usr_john', 'company', NULL, 'cmp_northstar', 1761910000000),
  ('flw_5', 'usr_john', 'user', 'usr_sarah', NULL, 1761910000000);

INSERT OR IGNORE INTO notifications (
  id, user_id, type, title, body, reference_type, reference_id, read_at, created_at
) VALUES
  (
    'ntf_1',
    'usr_sarah',
    'new_message',
    'New Direct message from John Miller',
    'Confirmed. Our engineering team completed the Joliet rail siding capacity audit this morning.',
    'conversation',
    'cnv_direct_1',
    NULL,
    1761950000000
  ),
  (
    'ntf_2',
    'usr_sarah',
    'new_message',
    'New Recognized message from Marcus Vance',
    'I have attached the redlined interconnection docket schedule for the Pennsylvania substation.',
    'conversation',
    'cnv_rec_1',
    NULL,
    1761948000000
  ),
  (
    'ntf_3',
    'usr_john',
    'access_promoted',
    'You now have Direct Access to Northstar Infrastructure Partners.',
    'Your messages to Northstar Infrastructure Partners will now appear in their Direct priority inbox.',
    'company',
    'cmp_northstar',
    NULL,
    1761920000000
  );

INSERT OR IGNORE INTO audit_logs (
  id, actor_user_id, action, target_type, target_id, metadata_json, created_at
) VALUES
  (
    'aud_seed_1',
    'usr_sarah',
    'access_level_changed_1_to_3',
    'user',
    'usr_sarah:usr_john',
    '{"senderUserId":"usr_john","recipientType":"user","recipientId":"usr_sarah","previousLevel":1,"newLevel":3}',
    1761910000000
  ),
  (
    'aud_seed_2',
    'usr_sarah',
    'access_level_changed_1_to_2',
    'user',
    'usr_sarah:usr_marcus',
    '{"senderUserId":"usr_marcus","recipientType":"user","recipientId":"usr_sarah","previousLevel":1,"newLevel":2}',
    1761915000000
  );

