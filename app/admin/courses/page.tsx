import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import AddCourseForm from './AddCourseForm';
import CoursesTable from './CoursesTable';
import ImportCoursesForm from './ImportCoursesForm';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const locale = await getLocale();
  const t = dict(locale).courses;
  const rows = await listCourses(await getDb());
  return (
    <div className="page-wide">
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-muted-fg">{t.intro}</p>
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">{t.importTitle}</h2>
        <ImportCoursesForm locale={locale} />
      </Card>
      <h2 className="mb-3 text-lg font-semibold">{t.addTitle}</h2>
      <Card className="mb-6"><AddCourseForm locale={locale} /></Card>
      <CoursesTable locale={locale} rows={rows} />
    </div>
  );
}
