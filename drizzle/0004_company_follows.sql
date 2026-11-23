ALTER TABLE `companies` ADD COLUMN `is_claimed` integer NOT NULL DEFAULT 1;

UPDATE `companies`
SET `is_claimed` = CASE
  WHEN EXISTS (
    SELECT 1 FROM `company_members` cm WHERE cm.`company_id` = `companies`.`id`
  ) THEN 1
  ELSE 0
END;

CREATE TABLE IF NOT EXISTS `company_follows` (
  `id` text PRIMARY KEY NOT NULL,
  `follower_company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `followed_company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `source` text NOT NULL DEFAULT 'user',
  `reason` text,
  `source_url` text,
  `created_at` integer NOT NULL,
  CHECK (`follower_company_id` <> `followed_company_id`)
);

CREATE UNIQUE INDEX IF NOT EXISTS `uq_company_follows_pair`
  ON `company_follows` (`follower_company_id`, `followed_company_id`);
CREATE INDEX IF NOT EXISTS `idx_company_follows_follower`
  ON `company_follows` (`follower_company_id`, `created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_company_follows_followed`
  ON `company_follows` (`followed_company_id`, `created_at` DESC);
