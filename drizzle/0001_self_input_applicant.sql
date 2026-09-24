-- 改為申請人自行填寫資料、條碼改為「學號-科號-B」、移除登入與掃描收件。
-- 舊申請單缺少姓名／學部別且條碼格式不同，無法轉換，故一併清除（課程資料保留）。
DELETE FROM `application_courses_a`;--> statement-breakpoint
DROP TABLE `applications`;--> statement-breakpoint
DROP TABLE `students`;--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`department` text NOT NULL,
	`degree` text NOT NULL,
	`course_b_code` text NOT NULL,
	`barcode` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_b_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "applications_student_id_len" CHECK(length("applications"."student_id") = 9),
	CONSTRAINT "applications_degree_check" CHECK("degree" IN ('大學部', '碩士班', '博士班', '在職專班')),
	CONSTRAINT "applications_barcode_len" CHECK(length("applications"."barcode") = 27)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_barcode_uq` ON `applications` (`barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_student_course_uq` ON `applications` (`student_id`,`course_b_code`);--> statement-breakpoint
ALTER TABLE `courses` ADD `note` text DEFAULT '' NOT NULL;
