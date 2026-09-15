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
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:items-end">
      <Field id="code" label="科號（15 碼）" hint="例：11510EECS200101">
        <input id="code" name="code" className="input font-mono" maxLength={15} minLength={15} pattern="[0-9A-Za-z]{15}" required />
      </Field>
      <Field id="name" label="課程名稱"><input id="name" name="name" className="input" required /></Field>
      <Field id="teacher" label="授課教師"><input id="teacher" name="teacher" className="input" required /></Field>
      <Field id="time" label="上課時間" hint="例：M1M2、T1T2R1R2"><input id="time" name="time" className="input font-mono" required /></Field>
      <Button type="submit" variant="primary" loading={pending}>新增</Button>
      {error && <p role="alert" className="text-sm text-danger sm:col-span-5">{error}</p>}
    </form>
  );
}
