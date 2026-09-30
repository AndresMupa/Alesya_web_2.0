CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`subtotal_in_cents` integer DEFAULT 0 NOT NULL,
	`discount_in_cents` integer DEFAULT 0 NOT NULL,
	`total_in_cents` integer DEFAULT 0 NOT NULL,
	`valid_until` text,
	`notes` text DEFAULT '' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`token` text NOT NULL,
	`created_by` text,
	`sent_at` integer,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_number` ON `quotes` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_token` ON `quotes` (`token`);--> statement-breakpoint
CREATE INDEX `idx_quotes_lead` ON `quotes` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status_created` ON `quotes` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `leads` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `expected_close` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `students` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `program` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `decision_maker` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `grades` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `sector` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `calendar` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `tech_level` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `budget_range` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `pain_points` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `competitors` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `score` integer DEFAULT 0 NOT NULL;