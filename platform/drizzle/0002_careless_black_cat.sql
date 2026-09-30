PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organization` text NOT NULL,
	`email` text,
	`phone` text,
	`message` text NOT NULL,
	`source` text DEFAULT 'website' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`owner` text,
	`external_id` text,
	`city` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`website` text,
	`notes` text DEFAULT '' NOT NULL,
	`last_contact` text,
	`next_follow_up` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_leads`("id", "name", "organization", "email", "phone", "message", "source", "stage", "owner", "external_id", "city", "priority", "website", "notes", "last_contact", "next_follow_up", "created_at", "updated_at") SELECT "id", "name", "organization", "email", "phone", "message", "source", "stage", "owner", NULL, NULL, 'medium', NULL, '', NULL, NULL, "created_at", "updated_at" FROM `leads`;--> statement-breakpoint
DROP TABLE `leads`;--> statement-breakpoint
ALTER TABLE `__new_leads` RENAME TO `leads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_leads_stage_created` ON `leads` (`stage`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_leads_email` ON `leads` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_leads_external_id` ON `leads` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_follow_up` ON `leads` (`next_follow_up`);