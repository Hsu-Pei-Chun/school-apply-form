import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createDb, databaseConfig, Db } from '@/lib/db/client';
import { courses, applications, applicationCoursesA, formSettings } from '@/lib/db/schema';

const SID = '113000001';
const CODE = '11510EECS200101';
const BARCODE = `${SID}-${CODE}-B`;
const APPLICANT = { studentId: SID, studentName: '學生一', department: '資工系', degree: '大學部' as const };

async function withCourse(): Promise<Db> {
  const db = await createDb(':memory:');
  await db.insert(courses).values({ code: CODE, name: '數學', teacher: '王教授', time: 'M1M2', createdAt: '2026-01-01' }).run();
  return db;
}

describe('databaseConfig', () => {
  it('有 TURSO_DATABASE_URL 時連線 Turso 並帶 token', () => {
    expect(databaseConfig({ TURSO_DATABASE_URL: 'libsql://x.turso.io', TURSO_AUTH_TOKEN: 't' }))
      .toEqual({ url: 'libsql://x.turso.io', authToken: 't' });
  });
  it('未設定時使用本機檔案 DATABASE_PATH，預設 data/app.db', () => {
    expect(databaseConfig({ DATABASE_PATH: '/app/data/app.db' })).toEqual({ url: 'file:/app/data/app.db' });
    expect(databaseConfig({})).toEqual({ url: 'file:data/app.db' });
  });
});

describe('createDb', () => {
  it('建立所有資料表且可查詢', async () => {
    const db = await createDb(':memory:');
    expect(await db.select().from(courses).all()).toEqual([]);
    expect(await db.select().from(applications).all()).toEqual([]);
    expect(await db.select().from(applicationCoursesA).all()).toEqual([]);
    expect(await db.select().from(formSettings).all()).toEqual([]);
  });

  it('本機檔案：自動建立資料夾；重複開啟同一檔案時 migration 不重跑、資料保留', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'school-apply-'));
    const url = `file:${path.join(dir, 'nested', 'app.db')}`;
    try {
      const db1 = await createDb(url);
      await db1.insert(courses).values({ code: CODE, name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run();
      db1.$client.close();
      const db2 = await createDb(url);
      expect(await db2.select().from(courses).all()).toHaveLength(1);
      db2.$client.close();
    } finally {
      // Windows 上檔案控制代碼可能尚未釋放，清理暫存資料夾失敗不影響測試結果
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 留給系統清理暫存 */ }
    }
  });

  it('courses.code 必須 15 碼', async () => {
    const db = await createDb(':memory:');
    await expect(db.insert(courses).values({ code: 'C001', name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run()).rejects.toThrow();
  });

  it('courses insert 不必給 nameEn、note（有 default）', async () => {
    const db = await createDb(':memory:');
    await db.insert(courses).values({ code: CODE, name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run();
    const [c] = await db.select().from(courses).all();
    expect(c.nameEn).toBe('');
    expect(c.note).toBe('');
  });

  it('courses.code 可含空格補位', async () => {
    const db = await createDb(':memory:');
    await db.insert(courses).values({ code: '11510CS  110400', name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run();
    expect((await db.select().from(courses).all())[0].code).toBe('11510CS  110400');
  });

  it('applications.student_id 必須 9 碼', async () => {
    const db = await withCourse();
    await expect(
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, studentId: '11300000', courseBCode: CODE, barcode: BARCODE, createdAt: 'z' }).run()
    ).rejects.toThrow();
  });

  it('applications.degree 只允許四種學部別', async () => {
    const db = await withCourse();
    await expect(
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, degree: 'bogus' as never, courseBCode: CODE, barcode: BARCODE, createdAt: 'z' }).run()
    ).rejects.toThrow();
  });

  it('applications.barcode 必須 27 碼', async () => {
    const db = await withCourse();
    await expect(
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, courseBCode: CODE, barcode: SID + CODE, createdAt: 'z' }).run()
    ).rejects.toThrow();
  });

  it('同學號同課程第二筆違反 UNIQUE', async () => {
    const db = await withCourse();
    const row = { ...APPLICANT, courseBCode: CODE, barcode: BARCODE, createdAt: '2026-01-01' };
    await db.insert(applications).values({ id: 'A000001', ...row }).run();
    await expect(db.insert(applications).values({ id: 'A000002', ...row }).run()).rejects.toThrow();
  });
});
