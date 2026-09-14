'use server';

import { redirect } from 'next/navigation';
import { login, logout } from '@/lib/auth';

function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/apply';
}

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const studentId = String(formData.get('studentId') ?? '').trim();
  const s = await login(studentId);
  if (!s) return { error: '查無此學號' };
  redirect(safeNext(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/login');
}
