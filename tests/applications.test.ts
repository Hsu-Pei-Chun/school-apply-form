import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db, isUniqueViolation } from '@/lib/db/client';
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
beforeEach(async () => {
  db = await createDb(':memory:');
  await createCourse(db, { code: B1, name: 'X-Class 線代', teacher: '李教授', time: 'M1M2', nameEn: 'Linear Algebra', note: '限大學部' });
  await createCourse(db, { code: B2, name: 'X-Class 機率', teacher: '張教授', time: 'T3T4' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起並遞增', async () => {
    expect(await nextApplicationId(db)).toBe('A000001');
    await createApplication(db, base);
    expect(await nextApplicationId(db)).toBe('A000002');
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
  it('成功：申請人資料寫入申請單、barcode = 學號-科號-B、A 課程依序寫入', async () => {
    const a = await createApplication(db, { ...base, coursesA: [A1, A2] });
    expect(a.id).toBe('A000001');
    expect(a.barcode).toBe(`${SID}-${B1}-B`);
    expect(a).toMatchObject({ studentId: SID, studentName: '王小明', department: '資訊工程學系', degree: '大學部' });
    const rows = await db.select().from(applicationCoursesA).all();
    expect(rows.map(r => [r.seq, r.code])).toEqual([[1, 'EE2010'], [2, 'CS1010']]);
  });
  it('申請人欄位會 trim', async () => {
    const a = await createApplication(db, { ...base, studentId: ` ${SID} `, studentName: ' 王小明 ', department: ' 資工系 ' });
    expect(a).toMatchObject({ studentId: SID, studentName: '王小明', department: '資工系' });
  });
  it('學號非 9 碼數字', async () => {
    for (const studentId of ['11300000', '1130000011', '11300000A', '']) {
      await expect(createApplication(db, { ...base, studentId })).rejects.toThrow('學號必須為 9 碼數字');
    }
  });
  it('姓名或科系空白', async () => {
    await expect(createApplication(db, { ...base, studentName: '  ' })).rejects.toThrow('姓名、科系皆必填');
    await expect(createApplication(db, { ...base, department: '' })).rejects.toThrow('姓名、科系皆必填');
  });
  it('姓名或科系過長', async () => {
    await expect(createApplication(db, { ...base, studentName: '王'.repeat(51) })).rejects.toThrow('姓名、科系最多 50 字');
  });
  it('學部別只接受四個選項', async () => {
    for (const degree of ['大學部', '碩士班', '博士班', '在職專班']) {
      await createApplication(db, { ...base, degree });
      await db.delete(applicationCoursesA).run();
      await db.delete(applications).run();
    }
    await expect(createApplication(db, { ...base, degree: '研究所' })).rejects.toThrow('請選擇學部別');
    await expect(createApplication(db, { ...base, degree: '' })).rejects.toThrow('請選擇學部別');
  });
  it('B 停用', async () => {
    await setCourseActive(db, B1, false);
    await expect(createApplication(db, base)).rejects.toThrow('課程不存在或已停用');
  });
  it('A 課程 0 門', async () => {
    await expect(createApplication(db, { ...base, coursesA: [] })).rejects.toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程欄位空白', async () => {
    await expect(createApplication(db, { ...base, coursesA: [{ ...A1, time: '  ' }] })).rejects.toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程 6 門', async () => {
    await expect(createApplication(db, { ...base, coursesA: [A1, A1, A1, A1, A1, A1] })).rejects.toThrow('一般課程最多五門');
  });
  it('A 課程欄位超過 100 字', async () => {
    const longName = 'A'.repeat(101);
    await expect(createApplication(db, { ...base, coursesA: [{ ...A1, name: longName }] })).rejects.toThrow('一般課程欄位最多 100 字');
  });
  it('同學號同 B 課程第二次被拒並回傳既有 id', async () => {
    const first = await createApplication(db, base);
    const err = await createApplication(db, { ...base, studentName: '別的名字', coursesA: [A2] }).catch(e => e);
    expect(err).toBeInstanceOf(DuplicateApplicationError);
    expect((err as DuplicateApplicationError).existingId).toBe(first.id);
    expect((err as Error).message).toBe('此學號已申請過此 X-Class 課程');
    expect(await db.select().from(applicationCoursesA).all()).toHaveLength(1);
  });
  it('同學號不同 B 課程可以；不同學號同 B 課程也可以', async () => {
    await createApplication(db, base);
    expect((await createApplication(db, { ...base, courseBCode: B2 })).id).toBe('A000002');
    expect((await createApplication(db, { ...base, studentId: '113000002' })).id).toBe('A000003');
  });
  it('B 無效時 A 子表不殘留（transaction）', async () => {
    await expect(createApplication(db, { ...base, courseBCode: '11510XXXX999999' })).rejects.toThrow();
    expect(await db.select().from(applicationCoursesA).all()).toHaveLength(0);
  });
  it('交易中途失敗會整筆回滾（申請單與 A 課程都不留）', async () => {
    // A 課程 seq 重複會撞 application_courses_a_seq_uq，發生在申請單已 insert 之後
    const originalTransaction = db.transaction.bind(db);
    (db as unknown as { transaction: typeof db.transaction }).transaction = ((fn: Parameters<typeof db.transaction>[0]) =>
      originalTransaction(async (tx) => {
        const r = await fn(tx);
        await tx.insert(applicationCoursesA).values({ applicationId: (r as { id: string }).id, seq: 1, code: 'x', name: 'x', time: 'x', teacher: 'x' }).run();
        return r;
      })) as typeof db.transaction;
    try {
      await expect(createApplication(db, base)).rejects.toThrow();
    } finally {
      (db as unknown as { transaction: typeof db.transaction }).transaction = originalTransaction;
    }
    expect(await db.select().from(applications).all()).toHaveLength(0);
    expect(await db.select().from(applicationCoursesA).all()).toHaveLength(0);
  });
  it('併發 race：兩個請求同時通過重複檢查、真正 insert 時才撞到 UNIQUE，仍轉為 DuplicateApplicationError', async () => {
    const SID2 = '113000002';
    const B3 = '11510CS00200103';
    await createCourse(db, { code: B3, name: 'X-Class 統計', teacher: '吳教授', time: 'W5W6' });

    const originalTransaction = db.transaction.bind(db);
    let raced = false;
    (db as unknown as { transaction: typeof db.transaction }).transaction = (async (fn: Parameters<typeof db.transaction>[0]) => {
      if (!raced) {
        raced = true;
        // 模擬另一個併發請求搶先在真正的 transaction 之前，寫入了同樣的 (studentId, courseBCode)，
        // 接著讓真正的 transaction 照常執行，由資料庫的 UNIQUE 約束擋下
        await db.insert(applications).values({
          id: 'A999999', studentId: SID2, studentName: '別人', department: 'x', degree: '碩士班',
          courseBCode: B3, barcode: makeBarcode(SID2, B3), createdAt: new Date().toISOString(),
        }).run();
      }
      return originalTransaction(fn);
    }) as typeof db.transaction;

    try {
      const caught = await createApplication(db, { ...applicant, studentId: SID2, coursesA: [A1], courseBCode: B3 }).catch(e => e);
      expect(caught).toBeInstanceOf(DuplicateApplicationError);
      expect((caught as DuplicateApplicationError).existingId).toBe('A999999');
    } finally {
      (db as unknown as { transaction: typeof db.transaction }).transaction = originalTransaction;
    }
  });
});

describe('isUniqueViolation', () => {
  it('辨識 libsql 實際丟出的 UNIQUE 錯誤（含被 drizzle 包裝的情況）', async () => {
    await createApplication(db, base);
    const row = { id: 'A000009', ...applicant, degree: '大學部' as const, courseBCode: B1, barcode: makeBarcode(SID, B1), createdAt: 'z' };
    const err = await db.insert(applications).values(row).run().catch(e => e);
    expect(isUniqueViolation(err)).toBe(true);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('getApplication', () => {
  it('回傳申請人、B 課程（含英文課名、備註）與 A 課程列表', async () => {
    await createApplication(db, { ...base, coursesA: [A1, A2] });
    const d = await getApplication(db, 'A000001');
    expect(d).toMatchObject({
      studentName: '王小明', department: '資訊工程學系', degree: '大學部',
      courseBName: 'X-Class 線代', courseBNameEn: 'Linear Algebra', courseBTeacher: '李教授', courseBTime: 'M1M2', courseBNote: '限大學部',
    });
    expect(d?.coursesA.map(c => c.name)).toEqual(['電路學', '計概']);
  });
  it('不存在回 undefined', async () => {
    expect(await getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('科號含空格的條碼', () => {
  const BS = '11510CS  110400';
  it('barcode 27 碼且保留空格', async () => {
    await createCourse(db, { code: BS, name: '關鍵科技', teacher: '磨課師', time: 'Mn' });
    const a = await createApplication(db, { ...base, courseBCode: BS });
    expect(a.barcode).toBe(`${SID}-${BS}-B`);
    expect(a.barcode.length).toBe(27);
  });
});
