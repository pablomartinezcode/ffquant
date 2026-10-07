CREATE TABLE `rating_history` (
	`snapshot_id` text NOT NULL,
	`player_id` text NOT NULL,
	`rating` text NOT NULL,
	`value` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `player_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rating_history_player_date` ON `rating_history` (`player_id`,`recorded_at`);