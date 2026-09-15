import { inArray } from 'drizzle-orm';
import { Db } from './db/client';
import { courses } from './db/schema';
import { createCourse, COURSE_CODE_RE, COURSE_CODE_ERROR } from './courses';

export type ParsedRow = { line: number; code: string; name: string; nameEn: string; teacher: string; time: string; raw: string };
export type PlanRow = ParsedRow & ({ status: 'add' } | { status: 'skip'; reason: string } | { status: 'error'; reason: string });
export type ImportPlan = { rows: PlanRow[]; addCount: number; skipCount: number; errorCount: number };

export const MAX_IMPORT_LINES = 2000;

type Field = 'code' | 'name' | 'nameEn' | 'time' | 'teacher';
const HEADER_ALIASES: Record<Field, string[]> = {
  code: ['科號'], name: ['中文課名', '課名', '課程名稱'], nameEn: ['英文課名'], time: ['上課時間', '時間'], teacher: ['教師', '授課教師'],
};
const REQUIRED: Field[] = ['code', 'name', 'time', 'teacher'];
const DEFAULT_ORDER: Field[] = ['code', 'name', 'nameEn', 'time', 'teacher'];
const FIELD_LABEL: Record<Field, string> = { code: '科號', name: '中文課名', nameEn: '英文課名', time: '上課時間', teacher: '教師' };

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
function splitLine(line: string): string[] {
  return line.includes('\t') ? line.split('\t').map(s => s.trim()) : splitCsv(line);
}
function headerMap(cells: string[]): Partial<Record<Field, number>> | null {
  if (!cells.some(c => c.includes('科號'))) return null;
  const map: Partial<Record<Field, number>> = {};
  cells.forEach((c, i) => {
    for (const f of Object.keys(HEADER_ALIASES) as Field[]) {
      if (map[f] === undefined && HEADER_ALIASES[f].some(a => c === a)) map[f] = i;
    }
  });
  const missing = REQUIRED.filter(f => map[f] === undefined);
  if (missing.length) throw new Error(`標題列缺少欄位：${missing.map(f => FIELD_LABEL[f]).join('、')}`);
  return map;
}

export function parseCourseImport(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines.length > MAX_IMPORT_LINES) throw new Error(`一次最多匯入 ${MAX_IMPORT_LINES} 行`);
  const rows: ParsedRow[] = [];
  let map: Partial<Record<Field, number>> | null = null;
  let first = true;
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw);
    if (first) {
      first = false;
      const m = headerMap(cells);
      if (m) { map = m; return; }
    }
    const get = (f: Field) => {
      const i = map ? map[f] : DEFAULT_ORDER.indexOf(f);
      return i === undefined || i < 0 ? '' : (cells[i] ?? '');
    };
    rows.push({ line: idx + 1, code: get('code'), name: get('name'), nameEn: get('nameEn'), teacher: get('teacher'), time: get('time'), raw });
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
    if (!COURSE_CODE_RE.test(r.code)) return { ...r, status: 'error', reason: COURSE_CODE_ERROR };
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
      createCourse(tx, { code: r.code, name: r.name, nameEn: r.nameEn, teacher: r.teacher, time: r.time });
      n++;
    }
    return n;
  });
}
