import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { formatDate } from '@/lib/format';
import { toggleCourse } from './actions';
import AddCourseForm from './AddCourseForm';

export const dynamic = 'force-dynamic';

export default function CoursesPage() {
  const rows = listCourses(getDb());
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>課程管理</h1>
      <AddCourseForm />
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', marginTop: 16 }}>
        <thead><tr><th>代碼</th><th>名稱</th><th>教師</th><th>狀態</th><th>建立時間</th><th></th></tr></thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.code}>
              <td>{s.code}</td>
              <td>{s.name}</td>
              <td>{s.teacher}</td>
              <td>{s.isActive ? '啟用' : '停用'}</td>
              <td>{formatDate(s.createdAt)}</td>
              <td>
                <form action={toggleCourse}>
                  <input type="hidden" name="code" value={s.code} />
                  <input type="hidden" name="isActive" value={s.isActive} />
                  <button type="submit">{s.isActive ? '停用' : '啟用'}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
