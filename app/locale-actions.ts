'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, toLocale } from '@/lib/i18n';

export async function setLocaleAction(locale: string): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, toLocale(locale), { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}
