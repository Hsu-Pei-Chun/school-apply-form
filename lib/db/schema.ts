import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  isActive: integer('is_active').notNull().default(1),
});

export const subjects = sqliteTable('subjects', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull().references(() => students.id),
    subjectCode: text('subject_code').notNull().references(() => subjects.code),
    status: text('status', { enum: ['printed', 'received'] }).notNull().default('printed'),
    createdAt: text('created_at').notNull(),
    receivedAt: text('received_at'),
  },
  (t) => [check('applications_status_check', sql`${t.status} IN ('printed', 'received')`)]
);

export type Student = typeof students.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Application = typeof applications.$inferSelect;
