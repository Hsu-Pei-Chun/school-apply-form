import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { getCurrentStudent } from '@/lib/auth';
import { listActiveCourses } from '@/lib/courses';
import { listApplicationsByStudent, MAX_COURSES_A } from '@/lib/applications';
import ApplyForm from './ApplyForm';
import MyApplications from './MyApplications';

export const dynamic = 'force-dynamic';

export default async function ApplyPage() {
  const student = await getCurrentStudent();
  if (!student) redirect('/login?next=/apply');

  const db = getDb();
  const courses = listActiveCourses(db).map(c => ({ code: c.code, name: c.name, teacher: c.teacher }));
  const mine = listApplicationsByStudent(db, student.id);

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">X-Class 課程修課申請</h1>
      <p className="mb-6 text-muted-fg">填寫後系統會產生一張含條碼的申請表，請列印、完成簽章後送交課務組。</p>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-fg">申請人（由登入資訊帶出）</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-muted-fg">學號</dt><dd className="font-mono">{student.id}</dd>
          <dt className="text-muted-fg">姓名</dt><dd>{student.name}</dd>
          <dt className="text-muted-fg">系級</dt><dd>{student.department}</dd>
        </dl>
      </Card>

      <Card className="mb-8"><ApplyForm courses={courses} maxCoursesA={MAX_COURSES_A} /></Card>

      <h2 className="mb-3 text-xl font-semibold">我的申請紀錄</h2>
      <Card className="p-0 sm:p-2"><MyApplications items={mine} /></Card>
    </>
  );
}
