CREATE TABLE `syllabi` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`teacher` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`pdf_url` text NOT NULL,
	`etag` text DEFAULT '' NOT NULL,
	`last_modified` text DEFAULT '' NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`compact` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`indexed_at` text NOT NULL
);
