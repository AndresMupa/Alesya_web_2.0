CREATE TABLE `lead_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_activities_lead_created` ON `lead_activities` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_lead_activities_created` ON `lead_activities` (`created_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order_created` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `leads` ADD `estimated_value_in_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `stage_changed_at` integer;--> statement-breakpoint
CREATE INDEX `idx_leads_stage_changed` ON `leads` (`stage`,`stage_changed_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_document` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `internal_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `backorder` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Los cuatro productos que vivían fijos en lib/catalog.ts pasan a la tabla products para
-- administrarse desde el panel (precio, publicación, destacado). Conservan su slug, así que los
-- enlaces /checkout?producto=<slug> siguen funcionando. Se venden bajo pedido (backorder).
INSERT OR IGNORE INTO `products` (`id`, `slug`, `sku`, `name`, `description`, `category`, `price_in_cents`, `stock`, `status`, `image_url`, `position`, `featured`, `backorder`, `created_at`, `updated_at`)
SELECT '968a818b-1e3e-4f29-93d8-462d8aa7995b', 'kit-arduino-explorador', 'ALX-KIT-ARD-EXP', 'Kit Arduino Explorador', 'Placa, sensores, actuadores y guía para 12 proyectos progresivos.', 'Electrónica', 28900000, 0, 'active', NULL, (SELECT coalesce(max(`position`), -1) + 1 FROM `products` WHERE `category` = 'Electrónica'), 1, 1, 1790900000000, 1790900000000;--> statement-breakpoint
INSERT OR IGNORE INTO `products` (`id`, `slug`, `sku`, `name`, `description`, `category`, `price_in_cents`, `stock`, `status`, `image_url`, `position`, `featured`, `backorder`, `created_at`, `updated_at`)
SELECT 'b9ac951e-c320-468e-83cd-38bfbc0895ec', 'ruta-lego-ev3', 'ALX-LIB-RUTA-EV3', 'Ruta LEGO EV3', 'Secuencia pedagógica para construir, programar y evaluar 8 retos.', 'Libros', 11900000, 0, 'active', NULL, (SELECT coalesce(max(`position`), -1) + 1 FROM `products` WHERE `category` = 'Libros'), 1, 1, 1790900000000, 1790900000000;--> statement-breakpoint
INSERT OR IGNORE INTO `products` (`id`, `slug`, `sku`, `name`, `description`, `category`, `price_in_cents`, `stock`, `status`, `image_url`, `position`, `featured`, `backorder`, `created_at`, `updated_at`)
SELECT '47abf1c0-d61d-4d63-a23e-efaa61b89ea9', 'kit-mecanismos-wedo', 'ALX-KIT-WEDO-MEC', 'Kit Mecanismos WeDo', 'Piezas complementarias y fichas para máquinas simples en primaria.', 'Robótica', 34900000, 0, 'active', NULL, (SELECT coalesce(max(`position`), -1) + 1 FROM `products` WHERE `category` = 'Robótica'), 1, 1, 1790900000000, 1790900000000;--> statement-breakpoint
INSERT OR IGNORE INTO `products` (`id`, `slug`, `sku`, `name`, `description`, `category`, `price_in_cents`, `stock`, `status`, `image_url`, `position`, `featured`, `backorder`, `created_at`, `updated_at`)
SELECT 'd0f87f63-c611-469b-91bc-e7176b88c144', 'laboratorio-impresion-3d', 'ALX-PRG-LAB-3D', 'Laboratorio de impresión 3D', 'Diseño, laminado y fabricación de un objeto funcional paso a paso.', 'Impresión 3D', 17900000, 0, 'active', NULL, (SELECT coalesce(max(`position`), -1) + 1 FROM `products` WHERE `category` = 'Impresión 3D'), 1, 1, 1790900000000, 1790900000000;--> statement-breakpoint
-- Las oportunidades existentes toman su fecha de creación como último cambio de etapa.
UPDATE `leads` SET `stage_changed_at` = `created_at` WHERE `stage_changed_at` IS NULL;
