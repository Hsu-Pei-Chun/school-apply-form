'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { dict, Locale } from '@/lib/i18n';
import { addCourse } from './actions';

export default function AddCourseForm({ locale }: { locale: Locale }) {
  const t = dict(locale).courses.add;
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
      <Field id="code" label={t.code} hint={t.codeHint}>
        <input id="code" name="code" className="input font-mono" maxLength={15} minLength={15} pattern="[0-9A-Za-z ]{15}" required />
      </Field>
      <Field id="name" label={t.name}><input id="name" name="name" className="input" required /></Field>
      <Field id="nameEn" label={t.nameEn}><input id="nameEn" name="nameEn" className="input" /></Field>
      <Field id="teacher" label={t.teacher}><input id="teacher" name="teacher" className="input" required /></Field>
      <Field id="time" label={t.time} hint={t.timeHint}><input id="time" name="time" className="input font-mono" required /></Field>
      <Field id="note" label={t.note}><input id="note" name="note" className="input" /></Field>
      <Button type="submit" variant="primary" loading={pending} className="sm:col-start-3">{t.submit}</Button>
      {error && <p role="alert" className="text-sm text-danger sm:col-span-3">{error}</p>}
    </form>
  );
}
