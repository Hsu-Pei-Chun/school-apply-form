'use server';

import { redirect } from 'next/navigation';
import { loginAdmin, logoutAdmin } from '@/lib/admin-auth';
import { safeNext } from '@/lib/admin-auth-core';
import { getLocale } from '@/lib/locale';
import { msg } from '@/lib/messages';

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const ok = await loginAdmin(String(formData.get('password') ?? ''));
  if (!ok) return { error: msg(await getLocale(), 'wrongPassword') };
  redirect(safeNext(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  await logoutAdmin();
  redirect('/');
}
