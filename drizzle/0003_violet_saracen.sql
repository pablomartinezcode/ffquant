CREATE TABLE `ranking_history` (
	`snapshot_id` text NOT NULL,
	`player_id` text NOT NULL,
	`format` text NOT NULL,
	`season` integer NOT NULL,
	`week` integer NOT NULL,
	`rank` integer NOT NULL,
	`position_rank` integer NOT NULL,
	`rating` real NOT NULL,
	`value` real NOT NULL,
	`ppg` real NOT NULL,
	`config` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `format`, `player_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ranking_history_player_format` ON `ranking_history` (`player_id`,`format`,`season`,`week`);--> statement-breakpoint
CREATE INDEX `ranking_history_week` ON `ranking_history` (`format`,`season`,`week`,`recorded_at`);