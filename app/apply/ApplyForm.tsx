'use client';

import { useState } from 'react';
import { lookupStudent, submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string };
type Props = { courses: CourseOption[] };

export default function ApplyForm({ courses }: Props) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; department: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [courseA, setCourseA] = useState('');
  const [courseB, setCourseB] = useState('');
  const [submitError, setSubmitError] = useState('');

  async function onBlur() {
    if (!studentId.trim()) return;
    const s = await lookupStudent(studentId);
    setStudent(s);
    setLookupError(s ? '' : '查無此學號');
  }

  async function onSubmit(formData: FormData) {
    setSubmitError('');
    const r = await submitApplication(formData);
    if (r?.error) setSubmitError(r.error);
  }

  return (
    <form action={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label htmlFor="studentId">學號</label>
      <input id="studentId" name="studentId" value={studentId} onChange={e => setStudentId(e.target.value)} onBlur={onBlur} required />
      {student && <p>{student.department} {student.name}</p>}
      {lookupError && <p role="alert" style={{ color: 'red' }}>{lookupError}</p>}

      <label htmlFor="courseACode">一般課程 A</label>
      <select id="courseACode" name="courseACode" required value={courseA} onChange={e => {
        const a = e.target.value;
        setCourseA(a);
        if (courseB === a) setCourseB('');
      }}>
        <option value="" disabled>請選擇</option>
        {courses.map(c => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
      </select>

      <label htmlFor="courseAStatus">A 課程修課狀態</label>
      <input id="courseAStatus" name="courseAStatus" defaultValue="已選上" />

      <label htmlFor="courseBCode">X-Class 課程 B</label>
      <select id="courseBCode" name="courseBCode" required value={courseB} onChange={e => setCourseB(e.target.value)}>
        <option value="" disabled>請選擇</option>
        {courses.filter(c => c.code !== courseA).map(c => (
          <option key={c.code} value={c.code}>{c.code} {c.name}（{c.teacher}）</option>
        ))}
      </select>

      {submitError && <p role="alert" style={{ color: 'red' }}>{submitError}</p>}
      <button type="submit" disabled={!student}>產生申請表</button>
    </form>
  );
}
