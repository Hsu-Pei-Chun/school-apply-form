'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { DEGREES } from '@/lib/degrees';
import { dict, Locale } from '@/lib/i18n';
import CourseARows, { CourseARow } from './CourseARows';
import { submitApplication } from './actions';

type CourseOption = { code: string; name: string; nameEn: string; teacher: string; time: string; note: string };

export default function ApplyForm({ courses, maxCoursesA, locale }: { courses: CourseOption[]; maxCoursesA: number; locale: Locale }) {
  const d = dict(locale);
  const t = d.apply;
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
        <legend className="mb-1 text-sm font-medium">{t.applicant}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="studentId" label={t.studentId} hint={t.studentIdHint}>
            <input id="studentId" name="studentId" className="input font-mono" required inputMode="numeric"
              pattern="\d{9}" minLength={9} maxLength={9} autoComplete="off" />
          </Field>
          <Field id="studentName" label={t.studentName}>
            <input id="studentName" name="studentName" className="input" required maxLength={50} autoComplete="name" />
          </Field>
          <Field id="department" label={t.department} hint={t.departmentHint}>
            <input id="department" name="department" className="input" required maxLength={50} />
          </Field>
          <Field id="degree" label={t.degree}>
            <select id="degree" name="degree" className="input" required defaultValue="">
              <option value="" disabled>{t.select}</option>
              {DEGREES.map(g => <option key={g} value={g}>{d.degrees[g]}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <CourseARows rows={rows} max={maxCoursesA} onChange={setRows} locale={locale} />

      <Field id="courseBCode" label={t.courseB} hint={t.courseBHint}>
        <select id="courseBCode" name="courseBCode" className="input" required value={courseB} onChange={e => setCourseB(e.target.value)}>
          <option value="" disabled>{t.select}</option>
          {courses.map(c => (
            <option key={c.code} value={c.code}>
              {c.code.replace(/ /g, ' ')}　{locale === 'en' ? c.nameEn || c.name : c.name}（{c.teacher}）　{c.time}{c.note ? `　※${c.note}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">
          {error.message}
          {error.existingId && (
            <>　<Link href={`/apply/${error.existingId}`} className="underline">{t.viewExisting}</Link></>
          )}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} disabled={!rowsComplete || !courseB}>{t.submit}</Button>
    </form>
  );
}
