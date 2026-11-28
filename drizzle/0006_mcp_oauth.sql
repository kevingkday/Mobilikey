CREATE TABLE IF NOT EXISTS `oauth_clients` (
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL UNIQUE,
  `client_secret_hash` text,
  `client_name` text NOT NULL,
  `redirect_uris_json` text NOT NULL,
  `token_endpoint_auth_method` text NOT NULL DEFAULT 'none',
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `oauth_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `code_hash` text NOT NULL UNIQUE,
  `client_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `redirect_uri` text NOT NULL,
  `scope` text NOT NULL DEFAULT '',
  `code_challenge` text NOT NULL,
  `code_challenge_method` text NOT NULL DEFAULT 'S256',
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `oauth_refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `client_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `scope` text NOT NULL DEFAULT '',
  `expires_at` integer NOT NULL,
  `revoked_at` integer,
  `created_at` integer NOT NULL
);
