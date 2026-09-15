'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { createCourse, setCourseActive } from '@/lib/courses';

export async function addCourse(formData: FormData): Promise<{ error: string } | void> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const teacher = String(formData.get('teacher') ?? '').trim();
  const time = String(formData.get('time') ?? '').trim();
  if (!code || !name || !teacher || !time) return { error: '代碼、名稱、授課教師、上課時間皆必填' };
  try {
    createCourse(getDb(), { code, name, teacher, time });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/admin/courses');
}

export async function toggleCourse(formData: FormData) {
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  setCourseActive(getDb(), code, !isActive);
  revalidatePath('/admin/courses');
}
