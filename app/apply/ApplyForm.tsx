'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { CheckIcon } from '@/components/icons';
import { lookupStudent, submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string };

export default function ApplyForm({ courses }: { courses: CourseOption[] }) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; department: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [courseA, setCourseA] = useState('');
  const [courseB, setCourseB] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [pending, startTransition] = useTransition();

  async function onBlur() {
    if (!studentId.trim()) return;
    const s = await lookupStudent(studentId);
    setStudent(s);
    setLookupError(s ? '' : '查無此學號');
  }

  function onSubmit(formData: FormData) {
    setSubmitError('');
    startTransition(async () => {
      const r = await submitApplication(formData);
      if (r?.error) setSubmitError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <Field id="studentId" label="學號" hint="例：S0001，輸入後離開欄位會自動帶出姓名" error={lookupError}>
        <input id="studentId" name="studentId" className="input" value={studentId}
          onChange={e => { setStudentId(e.target.value); setStudent(null); }} onBlur={onBlur} required autoComplete="off" />
      </Field>
      {student && (
        <p className="-mt-3 flex items-center gap-1.5 text-sm text-success">
          <CheckIcon className="size-4" /> {student.department}　{student.name}
        </p>
      )}

      <Field id="courseACode" label="一般課程 A" hint="你目前已選的正規課程">
        <select id="courseACode" name="courseACode" className="input" required value={courseA} onChange={e => {
          const a = e.target.value;
          setCourseA(a);
          if (courseB === a) setCourseB('');
        }}>
          <option value="" disabled>請選擇</option>
          {courses.map(c => <option key={c.code} value={c.code}>{c.code}　{c.name}</option>)}
        </select>
      </Field>

      <Field id="courseAStatus" label="A 課程修課狀態" hint="例：已選上、加簽中">
        <input id="courseAStatus" name="courseAStatus" className="input" defaultValue="已選上" />
      </Field>

      <Field id="courseBCode" label="X-Class 課程 B" hint="欲申請的 X-Class 課程，需事先與授課教師確認">
        <select id="courseBCode" name="courseBCode" className="input" required value={courseB} onChange={e => setCourseB(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.filter(c => c.code !== courseA).map(c => (
            <option key={c.code} value={c.code}>{c.code}　{c.name}（{c.teacher}）</option>
          ))}
        </select>
      </Field>

      {submitError && <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">{submitError}</p>}
      <Button type="submit" variant="primary" loading={pending} disabled={!student}>產生申請表</Button>
    </form>
  );
}
