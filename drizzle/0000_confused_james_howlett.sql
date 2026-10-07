CREATE TABLE `active_snapshot` (
	`key` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`previous_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upstream_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires` integer NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`snapshot_id` text NOT NULL,
	`id` text NOT NULL,
	`sleeper_id` text NOT NULL,
	`position` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `players_snapshot_position` ON `players` (`snapshot_id`,`position`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`manifest` text NOT NULL,
	`state` text DEFAULT 'staging' NOT NULL,
	`expected` integer NOT NULL,
	`created_at` text NOT NULL
);
