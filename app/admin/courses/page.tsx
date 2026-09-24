import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import { toggleCourse } from './actions';
import AddCourseForm from './AddCourseForm';
import ImportCoursesForm from './ImportCoursesForm';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const locale = await getLocale();
  const t = dict(locale).courses;
  const rows = await listCourses(await getDb());
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-muted-fg">{t.intro}</p>
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">{t.importTitle}</h2>
        <ImportCoursesForm locale={locale} />
      </Card>
      <h2 className="mb-3 text-lg font-semibold">{t.addTitle}</h2>
      <Card className="mb-6"><AddCourseForm locale={locale} /></Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-muted-fg">
            <tr>
              <th className="px-4 py-3 font-semibold">{t.code}</th>
              <th className="px-4 py-3 font-semibold">{t.name}</th>
              <th className="px-4 py-3 font-semibold">{t.nameEn}</th>
              <th className="px-4 py-3 font-semibold">{t.teacher}</th>
              <th className="px-4 py-3 font-semibold">{t.time}</th>
              <th className="px-4 py-3 font-semibold">{t.note}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t.status}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t.created}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.code} className={`border-t border-border even:bg-background/60 ${c.isActive ? '' : 'text-muted-fg'}`}>
                <td className="px-4 py-2 whitespace-pre font-mono">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.nameEn}</td>
                <td className="px-4 py-2">{c.teacher}</td>
                <td className="px-4 py-2 font-mono">{c.time}</td>
                <td className="px-4 py-2">{c.note}</td>
                <td className="px-4 py-2 whitespace-nowrap"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t.active : t.inactive}</Badge></td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleCourse}>
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="isActive" value={c.isActive} />
                    <Button type="submit" variant={c.isActive ? 'danger' : 'secondary'} className="min-h-11 whitespace-nowrap px-3 text-xs">
                      {c.isActive ? t.disable : t.enable}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
