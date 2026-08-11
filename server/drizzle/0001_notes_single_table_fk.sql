DROP TABLE `notes`;
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text,
	`orbit_id` text,
	`node_id` text,
	`relationship_id` text,
	`title` text NOT NULL,
	`text` text NOT NULL,
	`author` text,
	`created_at` real NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`orbit_id`) REFERENCES `orbits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
