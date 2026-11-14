import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import CoursesPanels from './CoursesPanels';
import CoursesTable from './CoursesTable';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const locale = await getLocale();
  const t = dict(locale).courses;
  const rows = await listCourses(await getDb());
  return (
    <div className="page-wide flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-fg">{t.intro}</p>
      </div>
      <CoursesPanels locale={locale} />
      <CoursesTable locale={locale} rows={rows} />
    </div>
  );
}
