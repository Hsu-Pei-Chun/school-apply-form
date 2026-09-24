'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { DEGREES } from '@/lib/degrees';
import CourseARows, { CourseARow } from './CourseARows';
import { submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string; time: string; note: string };

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
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">申請人資料</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="studentId" label="學號" hint="9 碼數字">
            <input id="studentId" name="studentId" className="input font-mono" required inputMode="numeric"
              pattern="\d{9}" minLength={9} maxLength={9} autoComplete="off" />
          </Field>
          <Field id="studentName" label="姓名">
            <input id="studentName" name="studentName" className="input" required maxLength={50} autoComplete="name" />
          </Field>
          <Field id="department" label="科系" hint="例：資訊工程學系">
            <input id="department" name="department" className="input" required maxLength={50} />
          </Field>
          <Field id="degree" label="學部別">
            <select id="degree" name="degree" className="input" required defaultValue="">
              <option value="" disabled>請選擇</option>
              {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <CourseARows rows={rows} max={maxCoursesA} onChange={setRows} />

      <Field id="courseBCode" label="X-Class 課程 B" hint="欲申請的 X-Class 課程（含上課時間），需事先與授課教師確認">
        <select id="courseBCode" name="courseBCode" className="input" required value={courseB} onChange={e => setCourseB(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.map(c => (
            <option key={c.code} value={c.code}>
              {c.code.replace(/ /g, ' ')}　{c.name}（{c.teacher}）　{c.time}{c.note ? `　※${c.note}` : ''}
            </option>
          ))}
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
