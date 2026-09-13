CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`subject_code` text NOT NULL,
	`status` text DEFAULT 'printed' NOT NULL,
	`created_at` text NOT NULL,
	`received_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_code`) REFERENCES `subjects`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "applications_status_check" CHECK("applications"."status" IN ('printed', 'received'))
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
