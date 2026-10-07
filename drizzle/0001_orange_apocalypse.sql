CREATE TABLE `artifacts` (
	`snapshot_id` text NOT NULL,
	`key` text NOT NULL,
	`sha256` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `key`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
