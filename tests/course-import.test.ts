import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses, COURSE_CODE_ERROR } from '@/lib/courses';
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
  it('逗號分隔也可（無標題時依 5 欄順序：科號,課名,英文課名,時間,教師）', () => {
    const rows = parseCourseImport(`${C1},線性代數1,,M1M2,許教授`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', nameEn: '', teacher: '許教授', time: 'M1M2' });
  });
  it('欄位會 trim；欄位不足時缺的為空字串', () => {
    const rows = parseCourseImport(` ${C1} \t 線性代數1 \t Stats \t M1M2 \t許教授`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', nameEn: 'Stats', time: 'M1M2', teacher: '許教授' });
    const rows2 = parseCourseImport(`${C1}\t線性代數1`);
    expect(rows2[0]).toMatchObject({ code: C1, name: '線性代數1', nameEn: '', time: '', teacher: '' });
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

describe('標題列對應', () => {
  it('依標題名稱對應，順序無關，英文課名可缺', () => {
    const text = '教師\t上課時間\t課名\t科號\n許教授\tM1M2\t線性代數1\t11510CHEM200104';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ code: '11510CHEM200104', name: '線性代數1', teacher: '許教授', time: 'M1M2', nameEn: '' });
  });
  it('校方 5 欄標題（科號、中文課名、英文課名、上課時間、教師）', () => {
    const text = '科號\t中文課名\t英文課名\t上課時間\t教師\n11510AIA 200100\t統計學--台大\tStatistics--NTU\tW2W3W4\t台大李宗穎,周瑞賢';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '統計學--台大', nameEn: 'Statistics--NTU', time: 'W2W3W4', teacher: '台大李宗穎,周瑞賢' });
  });
  it('無標題時依校方 5 欄順序', () => {
    const rows = parseCourseImport('11510AIA 200100\t統計學\tStatistics\tW2W3W4\t李宗穎');
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '統計學', nameEn: 'Statistics', time: 'W2W3W4', teacher: '李宗穎' });
  });
  it('標題缺必要欄位 → 整批錯誤', () => {
    expect(() => parseCourseImport('科號\t課名\t上課時間\n11510AIA 200100\tx\tM1')).toThrow('標題列缺少欄位：教師');
  });
  it('無標題列時，即使欄位內容含「科號」二字也不誤判為標題（需與別名完全相符）', () => {
    const rows = parseCourseImport('11510AIA 200100\t科號查詢實務\tCode Lookup\tM1M2\t王教授');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '科號查詢實務', nameEn: 'Code Lookup', time: 'M1M2', teacher: '王教授' });
  });
  it('標題儲存格前後含空白仍視為標題（trim 後完全相符）', () => {
    const text = ' 科號 \t 中文課名 \t 上課時間 \t 教師 \n11510AIA 200100\t統計學\tW2W3W4\t李宗穎';
    const rows = parseCourseImport(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '統計學', time: 'W2W3W4', teacher: '李宗穎' });
  });
});

describe('CSV 引號', () => {
  it('逗號模式：引號內逗號不切、雙引號跳脫', () => {
    const text = '科號,中文課名,英文課名,上課時間,教師\n11510AIA 200100,"統計學, 進階","Stats ""A""",W2W3W4,"台大李宗穎,周瑞賢"';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ name: '統計學, 進階', nameEn: 'Stats "A"', teacher: '台大李宗穎,周瑞賢' });
  });
});

describe('planCourseImport', () => {
  it('正常行 add；已存在 skip；格式錯誤 error；同批重複 error', () => {
    createCourse(db, { code: C2, name: '既有', teacher: '王', time: 'M1M2' });
    const rows = parseCourseImport([
      '科號\t中文課名\t英文課名\t上課時間\t教師',
      `${C1}\t線性代數1\t\tM1M2\t許教授`,
      `${C2}\t線性代數2\t\tT3T4\t許教授`,
      `C001\t壞科號\t\tM1M2\t許教授`,
      `${C3}\t\t\tM1M2\t許教授`,
      `${C1}\t重複\t\tM1M2\t許教授`,
    ].join('\n'));
    const plan = planCourseImport(db, rows);
    expect(plan.rows.map(r => r.status)).toEqual(['add', 'skip', 'error', 'error', 'error']);
    expect((plan.rows[2] as { reason: string }).reason).toBe(COURSE_CODE_ERROR);
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
    const plan = planCourseImport(db, parseCourseImport([
      '科號\t中文課名\t英文課名\t上課時間\t教師',
      `${C1}\t線性代數1\t\tM1M2\t許教授`,
      `${C2}\t新名\t\tT3T4\t新師`,
      `${C3}\t線代3\t\tW5W6\t李`,
    ].join('\n')));
    expect(applyCourseImport(db, plan)).toBe(2);
    const all = listCourses(db);
    expect(all.map(c => c.code)).toEqual([C1, C2, C3]);
    expect(all.find(c => c.code === C2)?.name).toBe('既有');
  });
  it('有 error 行時拒絕整批', () => {
    const plan = planCourseImport(db, parseCourseImport([
      '科號\t中文課名\t英文課名\t上課時間\t教師',
      `${C1}\t線性代數1\t\tM1M2\t許教授`,
      `C001\t壞\t\tM1M2\t王`,
    ].join('\n')));
    expect(() => applyCourseImport(db, plan)).toThrow('匯入內容有錯誤，請先修正');
    expect(listCourses(db)).toHaveLength(0);
  });
  it('寫入途中若科號已被併發插入則整批回滾', () => {
    const plan = planCourseImport(db, parseCourseImport([
      '科號\t中文課名\t英文課名\t上課時間\t教師',
      `${C1}\t線性代數1\t\tM1M2\t許教授`,
      `${C3}\t線代3\t\tW5W6\t李`,
    ].join('\n')));
    createCourse(db, { code: C3, name: '併發插入', teacher: '陳', time: 'M1M2' });
    expect(() => applyCourseImport(db, plan)).toThrow('課程代碼已存在');
    expect(listCourses(db).map(c => c.code)).toEqual([C3]);
  });
});

describe('校方真實檔案', () => {
  it('54 筆全部為 add，科號空格保留', () => {
    const text = readFileSync(path.join(__dirname, 'fixtures/xclass-11510.tsv'), 'utf-8');
    const plan = planCourseImport(db, parseCourseImport(text));
    expect(plan.rows).toHaveLength(54);
    expect(plan.errorCount).toBe(0);
    expect(plan.addCount).toBe(54);
    expect(plan.rows.find(r => r.code === '11510CS  110400')).toBeTruthy();
    expect(applyCourseImport(db, plan)).toBe(54);
    expect(listCourses(db).find(c => c.code === '11510AIA 200100')?.teacher).toBe('台大李宗穎,周瑞賢');
  });
});
