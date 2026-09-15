import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses } from '@/lib/courses';
import { parseCourseImport, planCourseImport, applyCourseImport, MAX_IMPORT_LINES } from '@/lib/course-import';

const C1 = '11510CHEM200104';
const C2 = '11510CHEM200114';
const C3 = '11510MATH200124';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('parseCourseImport', () => {
  it('Tab 分隔、跳過標題列與空行、處理 CRLF 與 BOM', () => {
    const text = '﻿科號\t課名\t授課教師\t上課時間\r\n' + `${C1}\t線性代數1\t許教授\tM1M2\r\n\r\n${C2}\t線性代數2\t許教授\tT3T4\r\n`;
    const rows = parseCourseImport(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, code: C1, name: '線性代數1', teacher: '許教授', time: 'M1M2' });
    expect(rows[1]).toMatchObject({ line: 4, code: C2, time: 'T3T4' });
  });
  it('逗號分隔也可', () => {
    const rows = parseCourseImport(`${C1},線性代數1,許教授,M1M2`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', teacher: '許教授', time: 'M1M2' });
  });
  it('欄位會 trim；欄位不足時缺的為空字串', () => {
    const rows = parseCourseImport(` ${C1} \t 線性代數1 \t許教授`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', teacher: '許教授', time: '' });
  });
  it('超過 MAX_IMPORT_LINES 行時拒絕整批', () => {
    const text = Array.from({ length: MAX_IMPORT_LINES + 1 }, () => `${C1}\t線性代數1\t許教授\tM1M2`).join('\n');
    expect(() => parseCourseImport(text)).toThrow('一次最多匯入');
  });
  it('標題列偵測：跳過開頭空行後的第一個非空行（若含科號）', () => {
    const rows = parseCourseImport(`\n科號\t課名\t授課教師\t上課時間\n${C1}\t線性代數1\t許教授\tM1M2`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ line: 3, code: C1 });
  });
});

describe('planCourseImport', () => {
  it('正常行 add；已存在 skip；格式錯誤 error；同批重複 error', () => {
    createCourse(db, { code: C2, name: '既有', teacher: '王', time: 'M1M2' });
    const rows = parseCourseImport([
      `${C1}\t線性代數1\t許教授\tM1M2`,
      `${C2}\t線性代數2\t許教授\tT3T4`,
      `C001\t壞科號\t許教授\tM1M2`,
      `${C3}\t\t許教授\tM1M2`,
      `${C1}\t重複\t許教授\tM1M2`,
    ].join('\n'));
    const plan = planCourseImport(db, rows);
    expect(plan.rows.map(r => r.status)).toEqual(['add', 'skip', 'error', 'error', 'error']);
    expect((plan.rows[2] as { reason: string }).reason).toBe('科號必須為 15 碼（英數或空格）');
    expect((plan.rows[3] as { reason: string }).reason).toBe('課名、授課教師、上課時間皆必填');
    expect((plan.rows[4] as { reason: string }).reason).toBe('同批內科號重複');
    expect(plan).toMatchObject({ addCount: 1, skipCount: 1, errorCount: 3 });
  });
  it('欄位不足 → error', () => {
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1`));
    expect(plan.rows[0].status).toBe('error');
  });
});

describe('applyCourseImport', () => {
  it('只寫入 add 行並回傳筆數；skip 不覆蓋既有', () => {
    createCourse(db, { code: C2, name: '既有', teacher: '王', time: 'M1M2' });
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1\t許教授\tM1M2\n${C2}\t新名\t新師\tT3T4\n${C3}\t線代3\t李\tW5W6`));
    expect(applyCourseImport(db, plan)).toBe(2);
    const all = listCourses(db);
    expect(all.map(c => c.code)).toEqual([C1, C2, C3]);
    expect(all.find(c => c.code === C2)?.name).toBe('既有');
  });
  it('有 error 行時拒絕整批', () => {
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1\t許教授\tM1M2\nC001\t壞\t王\tM1M2`));
    expect(() => applyCourseImport(db, plan)).toThrow('匯入內容有錯誤，請先修正');
    expect(listCourses(db)).toHaveLength(0);
  });
  it('寫入途中若科號已被併發插入則整批回滾', () => {
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1\t許教授\tM1M2\n${C3}\t線代3\t李\tW5W6`));
    createCourse(db, { code: C3, name: '併發插入', teacher: '陳', time: 'M1M2' });
    expect(() => applyCourseImport(db, plan)).toThrow('課程代碼已存在');
    expect(listCourses(db).map(c => c.code)).toEqual([C3]);
  });
});
