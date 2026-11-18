PRAGMA foreign_keys=OFF;

CREATE TABLE `announcements_new` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `author_user_id` text NOT NULL REFERENCES `users`(`id`),
  `category_id` text NOT NULL REFERENCES `announcement_categories`(`id`),
  `body` text NOT NULL,
  `external_url` text,
  `moderation_status` text NOT NULL DEFAULT 'published',
  `created_at` integer NOT NULL
);

INSERT INTO `announcements_new` (
  `id`, `company_id`, `author_user_id`, `category_id`, `body`, `external_url`, `moderation_status`, `created_at`
)
SELECT
  `id`, `company_id`, `author_user_id`, `category_id`, `body`, `external_url`, `moderation_status`, `created_at`
FROM `announcements`;

DROP TABLE `announcements`;
ALTER TABLE `announcements_new` RENAME TO `announcements`;

CREATE INDEX IF NOT EXISTS `idx_announcements_created` ON `announcements`(`created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_announcements_company` ON `announcements`(`company_id`, `created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_announcements_category` ON `announcements`(`category_id`, `created_at` DESC);

INSERT OR IGNORE INTO `announcement_categories` (`id`, `slug`, `name`, `sort_order`, `is_active`)
VALUES
  ('cat_personal_project', 'personal-project', 'Personal Project', 10, 1),
  ('cat_seeking_work', 'availability-seeking-work', 'Availability / Seeking Work', 11, 1);

PRAGMA foreign_keys=ON;
