CREATE TABLE `page_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`body` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_page_revisions_slug_created` ON `page_revisions` (`slug`,`created_at`);--> statement-breakpoint
CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`draft_updated_at` integer NOT NULL,
	`published_at` integer,
	`updated_by` text
);
