import { inArray } from 'drizzle-orm';
import { Db } from './db/client';
import { courses } from './db/schema';
import { createCourse } from './courses';

export type ParsedRow = { line: number; code: string; name: string; teacher: string; time: string; raw: string };
export type PlanRow = ParsedRow & ({ status: 'add' } | { status: 'skip'; reason: string } | { status: 'error'; reason: string });
export type ImportPlan = { rows: PlanRow[]; addCount: number; skipCount: number; errorCount: number };

const CODE_RE = /^[0-9A-Za-z]{15}$/;
export const MAX_IMPORT_LINES = 2000;

function splitLine(line: string): string[] {
  const sep = line.includes('\t') ? '\t' : ',';
  return line.split(sep).map(s => s.trim());
}

export function parseCourseImport(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines.length > MAX_IMPORT_LINES) throw new Error(`一次最多匯入 ${MAX_IMPORT_LINES} 行`);
  const rows: ParsedRow[] = [];
  let first = true;
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw);
    const isHeader = first && cells.some(c => c.includes('科號'));
    first = false;
    if (isHeader) return;
    const [code = '', name = '', teacher = '', time = ''] = cells;
    rows.push({ line: idx + 1, code, name, teacher, time, raw });
  });
  return rows;
}

export function planCourseImport(db: Db, rows: ParsedRow[]): ImportPlan {
  const codes = rows.map(r => r.code).filter(Boolean);
  const existing = new Set(
    codes.length ? db.select({ code: courses.code }).from(courses).where(inArray(courses.code, codes)).all().map(r => r.code) : []
  );
  const seen = new Set<string>();
  const out: PlanRow[] = rows.map(r => {
    if (!CODE_RE.test(r.code)) return { ...r, status: 'error', reason: '科號必須為 15 碼英數' };
    if (!r.name || !r.teacher || !r.time) return { ...r, status: 'error', reason: '課名、授課教師、上課時間皆必填' };
    if (seen.has(r.code)) return { ...r, status: 'error', reason: '同批內科號重複' };
    seen.add(r.code);
    if (existing.has(r.code)) return { ...r, status: 'skip', reason: '科號已存在' };
    return { ...r, status: 'add' };
  });
  return {
    rows: out,
    addCount: out.filter(r => r.status === 'add').length,
    skipCount: out.filter(r => r.status === 'skip').length,
    errorCount: out.filter(r => r.status === 'error').length,
  };
}

export function applyCourseImport(db: Db, plan: ImportPlan): number {
  if (plan.errorCount > 0) throw new Error('匯入內容有錯誤，請先修正');
  return db.transaction((tx) => {
    let n = 0;
    for (const r of plan.rows) {
      if (r.status !== 'add') continue;
      createCourse(tx, { code: r.code, name: r.name, teacher: r.teacher, time: r.time });
      n++;
    }
    return n;
  });
}
