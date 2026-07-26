ALTER TABLE `beverage_orders` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `beverage_orders` ADD `consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `beverage_orders` ADD `notification_status` text DEFAULT 'not-configured' NOT NULL;--> statement-breakpoint
ALTER TABLE `beverage_orders` ADD `notified_at` text;