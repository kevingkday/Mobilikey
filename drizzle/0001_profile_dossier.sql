ALTER TABLE `users` ADD COLUMN `expertise_json` text NOT NULL DEFAULT '[]';
ALTER TABLE `users` ADD COLUMN `highlights_json` text NOT NULL DEFAULT '[]';
ALTER TABLE `users` ADD COLUMN `experience_json` text NOT NULL DEFAULT '[]';
ALTER TABLE `users` ADD COLUMN `credentials_json` text NOT NULL DEFAULT '[]';
