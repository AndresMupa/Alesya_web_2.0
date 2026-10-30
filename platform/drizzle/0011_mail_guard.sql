ALTER TABLE `inbound_emails` ADD `risk_score` integer;--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `risk_level` text;--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `risk_signals` text;