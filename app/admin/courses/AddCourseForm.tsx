'use client';

import { useState } from 'react';
import { addCourse } from './actions';

export default function AddCourseForm() {
  const [error, setError] = useState('');
  async function onSubmit(formData: FormData) {
    setError('');
    const r = await addCourse(formData);
    if (r?.error) setError(r.error);
  }
  return (
    <form action={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
      <label htmlFor="code">代碼<br /><input id="code" name="code" required /></label>
      <label htmlFor="name">名稱<br /><input id="name" name="name" required /></label>
      <label htmlFor="teacher">授課教師<br /><input id="teacher" name="teacher" required /></label>
      <button type="submit">新增</button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </form>
  );
}
