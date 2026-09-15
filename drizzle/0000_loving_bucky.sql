CREATE TABLE `application_courses_a` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` text NOT NULL,
	`seq` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`time` text NOT NULL,
	`teacher` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_courses_a_seq_uq` ON `application_courses_a` (`application_id`,`seq`);--> statement-breakpoint
CREATE INDEX `application_courses_a_app_idx` ON `application_courses_a` (`application_id`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`course_b_code` text NOT NULL,
	`barcode` text NOT NULL,
	`status` text DEFAULT 'printed' NOT NULL,
	`created_at` text NOT NULL,
	`received_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_b_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "applications_status_check" CHECK("applications"."status" IN ('printed', 'received')),
	CONSTRAINT "applications_barcode_len" CHECK(length("applications"."barcode") = 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_barcode_uq` ON `applications` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_student_course_uq` ON `applications` (`student_id`,`course_b_code`);--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`teacher` text NOT NULL,
	`time` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "courses_code_len" CHECK(length("courses"."code") = 15)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`department` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "students_id_len" CHECK(length("students"."id") = 9)
);
