import { getDb } from '@/lib/db/client';
import { listActiveSubjects } from '@/lib/subjects';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  const subjects = listActiveSubjects(getDb()).map(s => ({ code: s.code, name: s.name }));
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>科目申請</h1>
      <ApplyForm subjects={subjects} />
    </main>
  );
}
