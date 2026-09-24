import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { applications, applicationCoursesA } from '@/lib/db/schema';
import { createCourse, setCourseActive } from '@/lib/courses';
import { createApplication, getApplication, nextApplicationId, makeBarcode, DuplicateApplicationError } from '@/lib/applications';

const SID = '113000001';
const B1 = '11510EECS200101';
const B2 = '11510MATH200102';
const A1 = { code: 'EE2010', name: '電路學', time: 'M3M4', teacher: '林教授' };
const A2 = { code: 'CS1010', name: '計概', time: 'T5T6', teacher: '陳教授' };
const applicant = { studentId: SID, studentName: '王小明', department: '資訊工程學系', degree: '大學部' };
const base = { ...applicant, coursesA: [A1], courseBCode: B1 };

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  createCourse(db, { code: B1, name: 'X-Class 線代', teacher: '李教授', time: 'M1M2', nameEn: 'Linear Algebra', note: '限大學部' });
  createCourse(db, { code: B2, name: 'X-Class 機率', teacher: '張教授', time: 'T3T4' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起並遞增', () => {
    expect(nextApplicationId(db)).toBe('A000001');
    createApplication(db, base);
    expect(nextApplicationId(db)).toBe('A000002');
  });
});

describe('makeBarcode', () => {
  it('格式為 學號-科號-B，共 27 碼', () => {
    expect(makeBarcode(SID, B1)).toBe('113000001-11510EECS200101-B');
    expect(makeBarcode(SID, B1)).toHaveLength(27);
  });
  it('科號含補位空格時原樣保留', () => {
    expect(makeBarcode(SID, '11510CS  110400')).toBe('113000001-11510CS  110400-B');
  });
});

describe('createApplication', () => {
  it('成功：申請人資料寫入申請單、barcode = 學號-科號-B、A 課程依序寫入', () => {
    const a = createApplication(db, { ...base, coursesA: [A1, A2] });
    expect(a.id).toBe('A000001');
    expect(a.barcode).toBe(`${SID}-${B1}-B`);
    expect(a).toMatchObject({ studentId: SID, studentName: '王小明', department: '資訊工程學系', degree: '大學部' });
    const rows = db.select().from(applicationCoursesA).all();
    expect(rows.map(r => [r.seq, r.code])).toEqual([[1, 'EE2010'], [2, 'CS1010']]);
  });
  it('申請人欄位會 trim', () => {
    const a = createApplication(db, { ...base, studentId: ` ${SID} `, studentName: ' 王小明 ', department: ' 資工系 ' });
    expect(a).toMatchObject({ studentId: SID, studentName: '王小明', department: '資工系' });
  });
  it('學號非 9 碼數字', () => {
    for (const studentId of ['11300000', '1130000011', '11300000A', '']) {
      expect(() => createApplication(db, { ...base, studentId })).toThrow('學號必須為 9 碼數字');
    }
  });
  it('姓名或科系空白', () => {
    expect(() => createApplication(db, { ...base, studentName: '  ' })).toThrow('姓名、科系皆必填');
    expect(() => createApplication(db, { ...base, department: '' })).toThrow('姓名、科系皆必填');
  });
  it('姓名或科系過長', () => {
    expect(() => createApplication(db, { ...base, studentName: '王'.repeat(51) })).toThrow('姓名、科系最多 50 字');
  });
  it('學部別只接受四個選項', () => {
    for (const degree of ['大學部', '碩士班', '博士班', '在職專班']) {
      expect(() => createApplication(db, { ...base, degree, courseBCode: B1, studentId: SID })).not.toThrow();
      db.delete(applicationCoursesA).run();
      db.delete(applications).run();
    }
    expect(() => createApplication(db, { ...base, degree: '研究所' })).toThrow('請選擇學部別');
    expect(() => createApplication(db, { ...base, degree: '' })).toThrow('請選擇學部別');
  });
  it('B 停用', () => {
    setCourseActive(db, B1, false);
    expect(() => createApplication(db, base)).toThrow('課程不存在或已停用');
  });
  it('A 課程 0 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程欄位空白', () => {
    expect(() => createApplication(db, { ...base, coursesA: [{ ...A1, time: '  ' }] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程 6 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [A1, A1, A1, A1, A1, A1] })).toThrow('一般課程最多五門');
  });
  it('A 課程欄位超過 100 字', () => {
    const longName = 'A'.repeat(101);
    expect(() => createApplication(db, { ...base, coursesA: [{ ...A1, name: longName }] })).toThrow('一般課程欄位最多 100 字');
  });
  it('同學號同 B 課程第二次被拒並回傳既有 id', () => {
    const first = createApplication(db, base);
    try {
      createApplication(db, { ...base, studentName: '別的名字', coursesA: [A2] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateApplicationError);
      expect((e as DuplicateApplicationError).existingId).toBe(first.id);
      expect((e as Error).message).toBe('此學號已申請過此 X-Class 課程');
    }
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(1);
  });
  it('同學號不同 B 課程可以；不同學號同 B 課程也可以', () => {
    createApplication(db, base);
    expect(createApplication(db, { ...base, courseBCode: B2 }).id).toBe('A000002');
    expect(createApplication(db, { ...base, studentId: '113000002' }).id).toBe('A000003');
  });
  it('B 無效時 A 子表不殘留（transaction）', () => {
    expect(() => createApplication(db, { ...base, courseBCode: '11510XXXX999999' })).toThrow();
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(0);
  });
  it('併發 race：兩個請求同時通過重複檢查、真正 insert 時才撞到 UNIQUE，仍轉為 DuplicateApplicationError', () => {
    const SID2 = '113000002';
    const B3 = '11510CS00200103';
    createCourse(db, { code: B3, name: 'X-Class 統計', teacher: '吳教授', time: 'W5W6' });

    const originalTransaction = db.transaction.bind(db);
    let raced = false;
    (db as unknown as { transaction: typeof db.transaction }).transaction = ((fn: Parameters<typeof db.transaction>[0]) => {
      if (!raced) {
        raced = true;
        // 模擬另一個併發請求搶先在真正的 transaction 之前，寫入了同樣的 (studentId, courseBCode)
        originalTransaction((tx) => {
          tx.insert(applications).values({
            id: 'A999999', studentId: SID2, studentName: '別人', department: 'x', degree: '碩士班',
            courseBCode: B3, barcode: makeBarcode(SID2, B3), createdAt: new Date().toISOString(),
          }).run();
        });
        const err = Object.assign(new Error('UNIQUE constraint failed: applications.barcode'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
        throw err;
      }
      return originalTransaction(fn);
    }) as typeof db.transaction;

    try {
      let caught: unknown;
      try {
        createApplication(db, { ...applicant, studentId: SID2, coursesA: [A1], courseBCode: B3 });
        expect.unreachable();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(DuplicateApplicationError);
      expect((caught as DuplicateApplicationError).existingId).toBe('A999999');
    } finally {
      (db as unknown as { transaction: typeof db.transaction }).transaction = originalTransaction;
    }
  });
});

describe('getApplication', () => {
  it('回傳申請人、B 課程（含英文課名、備註）與 A 課程列表', () => {
    createApplication(db, { ...base, coursesA: [A1, A2] });
    const d = getApplication(db, 'A000001');
    expect(d).toMatchObject({
      studentName: '王小明', department: '資訊工程學系', degree: '大學部',
      courseBName: 'X-Class 線代', courseBNameEn: 'Linear Algebra', courseBTeacher: '李教授', courseBTime: 'M1M2', courseBNote: '限大學部',
    });
    expect(d?.coursesA.map(c => c.name)).toEqual(['電路學', '計概']);
  });
  it('不存在回 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('科號含空格的條碼', () => {
  const BS = '11510CS  110400';
  it('barcode 27 碼且保留空格', () => {
    createCourse(db, { code: BS, name: '關鍵科技', teacher: '磨課師', time: 'Mn' });
    const a = createApplication(db, { ...base, courseBCode: BS });
    expect(a.barcode).toBe(`${SID}-${BS}-B`);
    expect(a.barcode.length).toBe(27);
  });
});
