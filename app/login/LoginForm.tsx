'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { dict, Locale } from '@/lib/i18n';
import { loginAction } from './actions';

export default function LoginForm({ next, locale }: { next: string; locale: Locale }) {
  const t = dict(locale).login;
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      const r = await loginAction(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field id="password" label={t.password} error={error}>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>{t.submit}</Button>
    </form>
  );
}
