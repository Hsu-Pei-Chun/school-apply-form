import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { formatDate } from '@/lib/format';
import { toggleCourse } from './actions';
import AddCourseForm from './AddCourseForm';
import ImportCoursesForm from './ImportCoursesForm';

export const dynamic = 'force-dynamic';

export default function CoursesPage() {
  const rows = listCourses(getDb());
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">課程管理</h1>
      <p className="mb-6 text-muted-fg">批次匯入或逐筆新增課程，並可停用。停用的課程不會出現在學生申請頁，但既有申請單仍可查詢。</p>
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">批次匯入</h2>
        <ImportCoursesForm />
      </Card>
      <h2 className="mb-3 text-lg font-semibold">逐筆新增</h2>
      <Card className="mb-6"><AddCourseForm /></Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-muted-fg">
            <tr>
              <th className="px-4 py-3 font-semibold">代碼</th>
              <th className="px-4 py-3 font-semibold">名稱</th>
              <th className="px-4 py-3 font-semibold">教師</th>
              <th className="px-4 py-3 font-semibold">時間</th>
              <th className="px-4 py-3 font-semibold">狀態</th>
              <th className="px-4 py-3 font-semibold">建立</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.code} className={`border-t border-border even:bg-background/60 ${c.isActive ? '' : 'text-muted-fg'}`}>
                <td className="px-4 py-2 font-mono">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.teacher}</td>
                <td className="px-4 py-2 font-mono">{c.time}</td>
                <td className="px-4 py-2"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? '啟用' : '停用'}</Badge></td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleCourse}>
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="isActive" value={c.isActive} />
                    <Button type="submit" variant={c.isActive ? 'danger' : 'secondary'} className="min-h-11 px-3 text-xs">
                      {c.isActive ? '停用' : '啟用'}
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
