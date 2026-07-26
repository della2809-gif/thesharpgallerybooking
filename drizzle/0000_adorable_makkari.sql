CREATE TABLE `waitlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_no` text NOT NULL,
	`phone` text NOT NULL,
	`party_size` integer DEFAULT 1 NOT NULL,
	`drink` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notified_at` text,
	`admitted_at` text
);
