'use client';

import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { DEGREES } from '@/lib/degrees';
import { dict, Locale } from '@/lib/i18n';
import CourseARows, { COURSE_A_FIELDS, CourseARow } from './CourseARows';
import CourseBPicker, { CourseOption, courseTitle } from './CourseBPicker';
import FormSection from './FormSection';
import { submitApplication } from './actions';

type Applicant = { studentId: string; studentName: string; department: string; degree: string };

export default function ApplyForm({ courses, maxCoursesA, locale }: { courses: CourseOption[]; maxCoursesA: number; locale: Locale }) {
  const d = dict(locale);
  const t = d.apply;
  const [applicant, setApplicant] = useState<Applicant>({ studentId: '', studentName: '', department: '', degree: '' });
  const [rows, setRows] = useState<CourseARow[]>([{ key: 1, code: '', name: '', time: '', teacher: '' }]);
  const [courseB, setCourseB] = useState('');
  const [error, setError] = useState<{ message: string; existingId?: string } | null>(null);
  const [courseBError, setCourseBError] = useState('');
  const [pending, startTransition] = useTransition();

  const set = (k: keyof Applicant) => (e: { target: { value: string } }) => setApplicant(a => ({ ...a, [k]: e.target.value }));

  // 摘要欄的填寫狀態
  const applicantMissing = (Object.keys(applicant) as Array<keyof Applicant>)
    .filter(k => (k === 'studentId' ? !/^\d{9}$/.test(applicant[k]) : !applicant[k].trim())).length;
  const courseAMissing = rows.reduce((n, r) => n + COURSE_A_FIELDS.filter(f => !r[f].trim()).length, 0);
  const picked = courses.find(c => c.code === courseB);

  // 送出鈕不預先停用：一般欄位交給瀏覽器的 required 驗證（會捲到並標出第一個缺漏欄位，通過才會觸發 submit）；
  // 課程 B 的值放在 hidden input，瀏覽器驗不到，這裡自己擋並把焦點移到搜尋框。
  // 刻意用 onSubmit 而不是 <form action>：React 19 會在 action 結束後重設未受控欄位。
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!courseB) {
      setCourseBError(t.missingCourseB);
      document.getElementById('courseBSearch')?.focus();
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitApplication(formData);
      if (r?.error) setError({ message: r.error, existingId: r.existingId });
    });
  }

  const status = (done: boolean, text: string) => (
    <span className={`font-medium ${done ? 'text-success' : 'text-muted-fg'}`}>{text}</span>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <FormSection id="applicant" n={1} done={applicantMissing === 0} title={t.applicant}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="studentId" label={t.studentId} hint={t.studentIdHint}>
              <input id="studentId" name="studentId" className="input font-mono" required inputMode="numeric"
                pattern="\d{9}" minLength={9} maxLength={9} autoComplete="off" value={applicant.studentId} onChange={set('studentId')} />
            </Field>
            <Field id="studentName" label={t.studentName}>
              <input id="studentName" name="studentName" className="input" required maxLength={50} autoComplete="name"
                value={applicant.studentName} onChange={set('studentName')} />
            </Field>
            <Field id="department" label={t.department} hint={t.departmentHint}>
              <input id="department" name="department" className="input" required maxLength={50}
                value={applicant.department} onChange={set('department')} />
            </Field>
            <Field id="degree" label={t.degree}>
              <select id="degree" name="degree" className="input" required value={applicant.degree} onChange={set('degree')}>
                <option value="" disabled>{t.select}</option>
                {DEGREES.map(g => <option key={g} value={g}>{d.degrees[g]}</option>)}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection id="courseA" n={2} done={courseAMissing === 0} title={t.courseATitle} sub={t.courseASub(maxCoursesA)}>
          <CourseARows rows={rows} max={maxCoursesA} onChange={setRows} locale={locale} />
        </FormSection>

        <FormSection id="courseB" n={3} done={Boolean(picked)} title={t.courseB} sub={t.courseBSub}>
          <CourseBPicker courses={courses} value={courseB} labelledBy="courseB-title" locale={locale} error={courseBError}
            onChange={v => { setCourseB(v); setCourseBError(''); }} />
        </FormSection>
      </div>

      <aside aria-labelledby="summary-title"
        className="flex flex-[1_1_260px] flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 lg:sticky lg:top-6">
        <h2 id="summary-title" className="font-semibold">{t.summaryTitle}</h2>
        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-fg">{t.applicant}</dt>
            <dd>{status(applicantMissing === 0, applicantMissing === 0 ? t.statusDone : t.statusMissing(applicantMissing))}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-fg">{t.courseATitle}</dt>
            <dd>{status(courseAMissing === 0, courseAMissing === 0 ? t.statusDone : t.statusMissing(courseAMissing))}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-fg">{t.courseB}</dt>
            <dd>{status(Boolean(picked), picked ? t.statusPicked : t.statusNotPicked)}</dd></div>
        </dl>
        {picked && (
          <div className="flex flex-col gap-0.5 border-t border-border pt-3">
            <span className="text-xs text-muted-fg">{t.courseB}</span>
            <span className="font-semibold">{courseTitle(picked, locale)}</span>
            <span className="text-sm text-muted-fg"><span className="font-mono">{picked.time}</span> · {picked.teacher}</span>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">
            {error.message}
            {error.existingId && (
              <>　<Link href={`/apply/${error.existingId}`} className="underline">{t.viewExisting}</Link></>
            )}
          </p>
        )}
        <Button type="submit" variant="primary" loading={pending} className="min-h-12 text-base">{t.submit}</Button>
        <p className="text-sm leading-relaxed text-muted-fg">{t.submitNote}</p>
      </aside>
    </form>
  );
}
