'use client';

import { useState } from 'react';
import { lookupStudent, submitApplication } from './actions';

type Props = { subjects: { code: string; name: string }[] };

export default function ApplyForm({ subjects }: Props) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; className: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
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
      <label>
        學號
        <input name="studentId" value={studentId} onChange={e => setStudentId(e.target.value)} onBlur={onBlur} required />
      </label>
      {student && <p>{student.className} {student.name}</p>}
      {lookupError && <p style={{ color: 'red' }}>{lookupError}</p>}
      <label>
        科目
        <select name="subjectCode" required defaultValue="">
          <option value="" disabled>請選擇</option>
          {subjects.map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
        </select>
      </label>
      {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      <button type="submit" disabled={!student}>產生申請表</button>
    </form>
  );
}
