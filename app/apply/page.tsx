import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listActiveCourses } from '@/lib/courses';
import { MAX_COURSES_A } from '@/lib/applications';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  const courses = listActiveCourses(getDb()).map(c => ({ code: c.code, name: c.name, teacher: c.teacher, time: c.time, note: c.note }));

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">X-Class 課程修課申請</h1>
      <p className="mb-6 text-muted-fg">填寫後系統會產生一張含條碼的申請表，請列印、完成簽章後送交課務組。</p>
      <Card><ApplyForm courses={courses} maxCoursesA={MAX_COURSES_A} /></Card>
    </>
  );
}
