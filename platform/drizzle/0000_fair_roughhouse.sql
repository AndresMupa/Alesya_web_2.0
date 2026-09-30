CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_content_slug_unique` ON `content_items` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_content_status_type` ON `content_items` (`status`,`type`);--> statement-breakpoint
CREATE TABLE `inventory_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`reason` text NOT NULL,
	`order_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_product_created` ON `inventory_events` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organization` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`source` text DEFAULT 'website' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`owner` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leads_stage_created` ON `leads` (`stage`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_leads_email` ON `leads` (`email`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_slug` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_in_cents` integer NOT NULL,
	`line_total_in_cents` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_items_order_id` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`shipping_city` text NOT NULL,
	`shipping_address` text NOT NULL,
	`subtotal_in_cents` integer NOT NULL,
	`shipping_in_cents` integer DEFAULT 0 NOT NULL,
	`total_in_cents` integer NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`status` text DEFAULT 'payment_pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_reference_unique` ON `orders` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_created` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer_email` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text DEFAULT 'wompi' NOT NULL,
	`provider_transaction_id` text,
	`reference` text NOT NULL,
	`method` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_in_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_reference_unique` ON `payments` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_payments_provider_transaction` ON `payments` (`provider_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_order_id` ON `payments` (`order_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`price_in_cents` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_products_status_category` ON `products` (`status`,`category`);