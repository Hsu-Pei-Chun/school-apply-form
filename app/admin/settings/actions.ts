'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin-auth';
import { saveFormSettings, resetFormSettings, getFormSettings, FormSettingsInput } from '@/lib/form-settings';
import { getLocale } from '@/lib/locale';
import { errorText } from '@/lib/messages';

type Result = { ok: true; values: FormSettingsInput } | { ok: false; error: string };

export async function saveSettings(formData: FormData): Promise<Result> {
  await requireAdmin('/admin/settings');
  const field = (name: string) => String(formData.get(name) ?? '');
  try {
    const values = saveFormSettings(getDb(), {
      termsZh: field('termsZh'), termsEn: field('termsEn'),
      submitNoteZh: field('submitNoteZh'), submitNoteEn: field('submitNoteEn'),
    });
    revalidatePath('/apply', 'layout');
    return { ok: true, values };
  } catch (e) {
    return { ok: false, error: errorText(await getLocale(), e) };
  }
}

export async function resetSettings(): Promise<Result> {
  await requireAdmin('/admin/settings');
  const db = getDb();
  resetFormSettings(db);
  revalidatePath('/apply', 'layout');
  return { ok: true, values: getFormSettings(db) };
}
