'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import CourseARows, { CourseARow } from './CourseARows';
import { submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string; time: string };

export default function ApplyForm({ courses, maxCoursesA }: { courses: CourseOption[]; maxCoursesA: number }) {
  const [rows, setRows] = useState<CourseARow[]>([{ key: 1, code: '', name: '', time: '', teacher: '' }]);
  const [courseB, setCourseB] = useState('');
  const [error, setError] = useState<{ message: string; existingId?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const rowsComplete = rows.every(r => r.code.trim() && r.name.trim() && r.time.trim() && r.teacher.trim());

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await submitApplication(formData);
      if (r?.error) setError({ message: r.error, existingId: r.existingId });
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <CourseARows rows={rows} max={maxCoursesA} onChange={setRows} />

      <Field id="courseBCode" label="X-Class 課程 B" hint="欲申請的 X-Class 課程（含上課時間），需事先與授課教師確認">
        <select id="courseBCode" name="courseBCode" className="input" required value={courseB} onChange={e => setCourseB(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.map(c => <option key={c.code} value={c.code}>{c.code}　{c.name}（{c.teacher}）　{c.time}</option>)}
        </select>
      </Field>

      {error && (
        <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">
          {error.message}
          {error.existingId && (
            <>　<Link href={`/apply/${error.existingId}`} className="underline">查看／重新列印原申請表</Link></>
          )}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} disabled={!rowsComplete || !courseB}>產生申請表</Button>
    </form>
  );
}
