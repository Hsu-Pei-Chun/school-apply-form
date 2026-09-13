import { getDb } from '@/lib/db/client';
import { listActiveCourses } from '@/lib/courses';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  const courses = listActiveCourses(getDb()).map(c => ({ code: c.code, name: c.name, teacher: c.teacher }));
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>科目申請</h1>
      <ApplyForm courses={courses} />
    </main>
  );
}
