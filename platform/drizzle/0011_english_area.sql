CREATE TABLE `english_access_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`grades` text NOT NULL,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_english_codes_code_unique` ON `english_access_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_english_codes_created` ON `english_access_codes` (`created_at`);--> statement-breakpoint
CREATE TABLE `english_levels` (
	`grade` integer PRIMARY KEY NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `english_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`grade` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`file_name` text,
	`file_size` integer,
	`external_url` text,
	`free` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_english_resources_grade` ON `english_resources` (`grade`,`status`,`position`);