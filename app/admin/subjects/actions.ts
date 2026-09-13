'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { createSubject, setSubjectActive } from '@/lib/subjects';

export async function addSubject(formData: FormData): Promise<{ error: string } | void> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!code || !name) return { error: '代碼與名稱皆必填' };
  try {
    createSubject(getDb(), { code, name });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/admin/subjects');
}

export async function toggleSubject(formData: FormData) {
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  setSubjectActive(getDb(), code, !isActive);
  revalidatePath('/admin/subjects');
}
