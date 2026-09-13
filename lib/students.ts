import { eq } from 'drizzle-orm';
import { Db } from './db/client';
import { students, Student } from './db/schema';

export function findStudent(db: Db, id: string): Student | undefined {
  return db.select().from(students).where(eq(students.id, id)).get();
}
