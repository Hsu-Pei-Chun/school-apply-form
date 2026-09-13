import { getDb } from '@/lib/db/client';
import { listSubjects } from '@/lib/subjects';
import { toggleSubject } from './actions';
import AddSubjectForm from './AddSubjectForm';

export const dynamic = 'force-dynamic';

export default function SubjectsPage() {
  const rows = listSubjects(getDb());
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>科目管理</h1>
      <AddSubjectForm />
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', marginTop: 16 }}>
        <thead><tr><th>代碼</th><th>名稱</th><th>狀態</th><th>建立時間</th><th></th></tr></thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.code}>
              <td>{s.code}</td>
              <td>{s.name}</td>
              <td>{s.isActive ? '啟用' : '停用'}</td>
              <td>{s.createdAt.slice(0, 10)}</td>
              <td>
                <form action={toggleSubject}>
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
