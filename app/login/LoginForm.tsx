'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { loginAction } from './actions';

export default function LoginForm({ next }: { next: string }) {
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
      <Field id="studentId" label="學號" hint="Demo 環境：輸入學號即可登入（例：113000001），正式環境將由校務系統單一登入取代" error={error}>
        <input id="studentId" name="studentId" className="input" required autoComplete="username" inputMode="numeric" maxLength={9} />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>登入</Button>
    </form>
  );
}
