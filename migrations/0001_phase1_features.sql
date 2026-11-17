CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_cents` integer NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_user_idx` ON `ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `ledger_created_idx` ON `ledger` (`created_at`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_members_team_idx` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_unique` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tips` (
	`id` text PRIMARY KEY NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`video_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tips_to_user_idx` ON `tips` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `tips_from_user_idx` ON `tips` (`from_user_id`);--> statement-breakpoint
CREATE TABLE `video_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`stream_uid` text,
	`stream_upload_id` text,
	`thumbnail_url` text,
	`thumbnail_key` text,
	`duration` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_versions_video_idx` ON `video_versions` (`video_id`);--> statement-breakpoint
ALTER TABLE `comments` ADD `timestamp_sec` real;--> statement-breakpoint
ALTER TABLE `videos` ADD `is_unlisted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `allowed_domains` text;