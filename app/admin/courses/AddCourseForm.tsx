'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { addCourse } from './actions';

export default function AddCourseForm() {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      const r = await addCourse(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-3 sm:items-end">
      <Field id="code" label="科號（15 碼）" hint="例：11510AIA 500700（含空格補位，共 15 碼）">
        <input id="code" name="code" className="input font-mono" maxLength={15} minLength={15} pattern="[0-9A-Za-z ]{15}" required />
      </Field>
      <Field id="name" label="課程名稱"><input id="name" name="name" className="input" required /></Field>
      <Field id="nameEn" label="英文課名（選填）"><input id="nameEn" name="nameEn" className="input" /></Field>
      <Field id="teacher" label="授課教師"><input id="teacher" name="teacher" className="input" required /></Field>
      <Field id="time" label="上課時間" hint="例：M1M2、T1T2R1R2"><input id="time" name="time" className="input font-mono" required /></Field>
      <Field id="note" label="備註（選填）"><input id="note" name="note" className="input" /></Field>
      <Button type="submit" variant="primary" loading={pending} className="sm:col-start-3">新增</Button>
      {error && <p role="alert" className="text-sm text-danger sm:col-span-3">{error}</p>}
    </form>
  );
}
