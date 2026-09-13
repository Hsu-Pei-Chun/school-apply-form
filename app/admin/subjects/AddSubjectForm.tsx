'use client';

import { useState } from 'react';
import { addSubject } from './actions';

export default function AddSubjectForm() {
  const [error, setError] = useState('');
  async function onSubmit(formData: FormData) {
    setError('');
    const r = await addSubject(formData);
    if (r?.error) setError(r.error);
  }
  return (
    <form action={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
      <label>代碼<br /><input name="code" required /></label>
      <label>名稱<br /><input name="name" required /></label>
      <button type="submit">新增</button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </form>
  );
}
