-- Phase 3 (launch): discovery, community, lead capture, clips, hotspots,
-- presets, collaborative playlists, offline, RSS, A/B, simulcast, webinars,
-- branding, and per-video controls.

ALTER TABLE `videos` ADD COLUMN `is_featured` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `require_email` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `allow_download` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `end_screen_type` text NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `end_screen_url` text;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `end_screen_cta` text;--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `maturity_rating` text NOT NULL DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `videos` ADD COLUMN `audio_quality` text NOT NULL DEFAULT 'standard';--> statement-breakpoint

CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`title` text,
	`start_sec` real NOT NULL,
	`end_sec` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `clips_video_idx` ON `clips` (`video_id`);--> statement-breakpoint

CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`video_id` text,
	`type` text NOT NULL DEFAULT 'text',
	`text` text,
	`image_key` text,
	`poll_options` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `posts_user_idx` ON `posts` (`user_id`);--> statement-breakpoint

CREATE TABLE `post_reactions` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `leads_video_idx` ON `leads` (`video_id`);--> statement-breakpoint
CREATE INDEX `leads_user_idx` ON `leads` (`user_id`);--> statement-breakpoint

CREATE TABLE `hotspots` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`start_sec` real NOT NULL,
	`end_sec` real,
	`label` text NOT NULL,
	`url` text,
	`color` text NOT NULL DEFAULT '#3b82f6',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `hotspots_video_idx` ON `hotspots` (`video_id`);--> statement-breakpoint

CREATE TABLE `player_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`primary_color` text NOT NULL DEFAULT '#3b82f6',
	`watermark_text` text,
	`show_watermark` integer NOT NULL DEFAULT 0,
	`auto_play` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `player_presets_user_idx` ON `player_presets` (`user_id`);--> statement-breakpoint

CREATE TABLE `playlist_members` (
	`playlist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL DEFAULT 'editor',
	`created_at` integer NOT NULL,
	PRIMARY KEY(`playlist_id`, `user_id`),
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `offline_downloads` (
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `video_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

CREATE TABLE `feed_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`category_id` text,
	`last_fetched_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `feed_sources_user_idx` ON `feed_sources` (`user_id`);--> statement-breakpoint

CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`variant_a` text,
	`variant_b` text,
	`views_a` integer NOT NULL DEFAULT 0,
	`views_b` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'running',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `experiments_video_idx` ON `experiments` (`video_id`);--> statement-breakpoint

CREATE TABLE `simulcast_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`live_stream_id` text NOT NULL,
	`name` text NOT NULL,
	`rtmp_url` text NOT NULL,
	`stream_key` text NOT NULL,
	`enabled` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`live_stream_id`) REFERENCES `live_streams`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `simulcast_live_idx` ON `simulcast_destinations` (`live_stream_id`);--> statement-breakpoint

CREATE TABLE `webinars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`scheduled_at` integer,
	`live_stream_id` text,
	`status` text NOT NULL DEFAULT 'scheduled',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`live_stream_id`) REFERENCES `live_streams`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `webinars_user_idx` ON `webinars` (`user_id`);--> statement-breakpoint

CREATE TABLE `webinar_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`webinar_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`webinar_id`) REFERENCES `webinars`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `webinar_regs_webinar_idx` ON `webinar_registrations` (`webinar_id`);--> statement-breakpoint

CREATE TABLE `channel_branding` (
	`user_id` text PRIMARY KEY NOT NULL,
	`brand_name` text,
	`brand_color` text NOT NULL DEFAULT '#3b82f6',
	`tagline` text,
	`logo_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint