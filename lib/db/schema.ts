import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  isActive: integer('is_active').notNull().default(1),
});

export const courses = sqliteTable('courses', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  teacher: text('teacher').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull().references(() => students.id),
    courseACode: text('course_a_code').notNull().references(() => courses.code),
    courseAStatus: text('course_a_status').notNull(),
    courseBCode: text('course_b_code').notNull().references(() => courses.code),
    status: text('status', { enum: ['printed', 'received'] }).notNull().default('printed'),
    createdAt: text('created_at').notNull(),
    receivedAt: text('received_at'),
  },
  (t) => [check('applications_status_check', sql`${t.status} IN ('printed', 'received')`)]
);

export type Student = typeof students.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Application = typeof applications.$inferSelect;
