ALTER TABLE `products` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `products` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_products_category_position` ON `products` (`category`,`position`);
