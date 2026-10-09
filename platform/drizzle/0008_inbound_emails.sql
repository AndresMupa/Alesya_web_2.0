CREATE TABLE `inbound_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`mailbox` text NOT NULL,
	`uid_validity` text NOT NULL,
	`uid` integer NOT NULL,
	`from_email` text,
	`from_name` text,
	`subject` text DEFAULT '' NOT NULL,
	`received_at` integer,
	`result` text NOT NULL,
	`reason` text,
	`lead_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inbound_emails_message_id` ON `inbound_emails` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_inbound_emails_cursor` ON `inbound_emails` (`mailbox`,`uid_validity`,`uid`);--> statement-breakpoint
CREATE INDEX `idx_inbound_emails_created` ON `inbound_emails` (`created_at`);