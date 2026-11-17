-- Phase 2 feature expansion: AI suite, deep analytics, live streaming,
-- payments (rental/purchase/membership), player customization.

ALTER TABLE `videos` ADD COLUMN `monetization_type` text NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `price_cents` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `allow_embed` integer NOT NULL DEFAULT 1;--> statement-breakpoint

ALTER TABLE `video_watch_events` ADD COLUMN `country` text;--> statement-breakpoint
ALTER TABLE `video_watch_events` ADD COLUMN `device` text;--> statement-breakpoint
ALTER TABLE `video_watch_events` ADD COLUMN `referrer` text;--> statement-breakpoint

CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`start_sec` real NOT NULL,
	`end_sec` real,
	`order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `chapters_video_idx` ON `chapters` (`video_id`);--> statement-breakpoint

CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`language` text NOT NULL DEFAULT 'en',
	`status` text NOT NULL DEFAULT 'draft',
	`source` text NOT NULL DEFAULT 'manual',
	`text` text,
	`segments` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `transcripts_video_idx` ON `transcripts` (`video_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transcripts_video_lang_idx` ON `transcripts` (`video_id`, `language`);--> statement-breakpoint

CREATE TABLE `video_embeddings` (
	`video_id` text PRIMARY KEY NOT NULL,
	`embedding` text NOT NULL,
	`model` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `live_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`video_id` text,
	`stream_input_id` text NOT NULL,
	`rtmp_url` text,
	`stream_key` text,
	`playback_url` text,
	`title` text,
	`status` text NOT NULL DEFAULT 'ready',
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `live_streams_stream_input_id_unique` ON `live_streams` (`stream_input_id`);--> statement-breakpoint
CREATE INDEX `live_streams_creator_idx` ON `live_streams` (`creator_id`);--> statement-breakpoint

CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL DEFAULT 'usd',
	`provider` text NOT NULL DEFAULT 'stripe',
	`provider_session_id` text,
	`status` text NOT NULL DEFAULT 'pending',
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `purchases_user_video_idx` ON `purchases` (`user_id`, `video_id`);--> statement-breakpoint

CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`tier_name` text NOT NULL DEFAULT 'Supporter',
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL DEFAULT 'usd',
	`provider` text NOT NULL DEFAULT 'stripe',
	`provider_customer_id` text,
	`status` text NOT NULL DEFAULT 'active',
	`current_period_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_creator_idx` ON `memberships` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_user_creator_idx` ON `memberships` (`user_id`, `creator_id`);--> statement-breakpoint

CREATE TABLE `player_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`primary_color` text NOT NULL DEFAULT '#3b82f6',
	`watermark_text` text,
	`show_watermark` integer NOT NULL DEFAULT 0,
	`auto_play` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `creator_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`membership_enabled` integer NOT NULL DEFAULT 0,
	`membership_price_cents` integer NOT NULL DEFAULT 500,
	`membership_tier_name` text NOT NULL DEFAULT 'Supporter',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint