ALTER TABLE `leads` ADD `consent_version` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `marketing_consent_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `marketing_consent_version` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `marketing_channels` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `marketing_opt_out_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `unsubscribe_token` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `utm_source` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `utm_medium` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `utm_campaign` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `utm_content` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `utm_term` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `referrer` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `landing_page` text;--> statement-breakpoint
-- Contactos anteriores: el texto de autorización de datos no ha cambiado desde que se guarda `consent_at`, así que se les asigna su versión.
UPDATE `leads` SET `consent_version` = 'datos-diagnostico-v1-borrador' WHERE `consent_at` IS NOT NULL;--> statement-breakpoint
-- Todo contacto existente recibe su token de baja (128 bits aleatorios) antes de volver único el índice.
UPDATE `leads` SET `unsubscribe_token` = lower(hex(randomblob(16))) WHERE `unsubscribe_token` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_leads_unsubscribe_token` ON `leads` (`unsubscribe_token`);