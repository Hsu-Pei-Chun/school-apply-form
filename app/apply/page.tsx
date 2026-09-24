import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listActiveCourses } from '@/lib/courses';
import { MAX_COURSES_A } from '@/lib/applications';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default async function ApplyPage() {
  const locale = await getLocale();
  const t = dict(locale).apply;
  const courses = listActiveCourses(getDb()).map(c => ({ code: c.code, name: c.name, nameEn: c.nameEn, teacher: c.teacher, time: c.time, note: c.note }));

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-muted-fg">{t.intro}</p>
      <Card><ApplyForm courses={courses} maxCoursesA={MAX_COURSES_A} locale={locale} /></Card>
    </>
  );
}
