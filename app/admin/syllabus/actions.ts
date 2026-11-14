'use server';

import { getDb } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin-auth';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import { normalizeIndexUrl, saveSyllabusIndexUrl } from '@/lib/syllabus/store';
import { getIndexStatus, startIndexing, IndexStatus } from '@/lib/syllabus/indexer';

type Result = { ok: true; status: IndexStatus } | { ok: false; error: string };

export async function startIndexAction(formData: FormData): Promise<Result> {
  await requireAdmin('/admin/syllabus');
  const url = normalizeIndexUrl(String(formData.get('url') ?? ''));
  if (!url) return { ok: false, error: dict(await getLocale()).syllabus.invalidUrl };
  await saveSyllabusIndexUrl(await getDb(), url);
  return { ok: true, status: startIndexing(url) };
}

export async function indexStatusAction(): Promise<IndexStatus> {
  await requireAdmin('/admin/syllabus');
  return getIndexStatus();
}
