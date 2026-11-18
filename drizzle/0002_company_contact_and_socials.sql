ALTER TABLE `companies` ADD COLUMN `contact_email` text NOT NULL DEFAULT '';
ALTER TABLE `companies` ADD COLUMN `contact_phone` text NOT NULL DEFAULT '';
ALTER TABLE `companies` ADD COLUMN `social_links_json` text NOT NULL DEFAULT '{}';
