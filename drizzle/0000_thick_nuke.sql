CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`course_a_code` text NOT NULL,
	`course_a_status` text NOT NULL,
	`course_b_code` text NOT NULL,
	`status` text DEFAULT 'printed' NOT NULL,
	`created_at` text NOT NULL,
	`received_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_a_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_b_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "applications_status_check" CHECK("applications"."status" IN ('printed', 'received'))
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`department` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
