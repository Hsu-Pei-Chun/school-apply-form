import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, deleteCourses, listCourses, listActiveCourses, setCourseActive } from '@/lib/courses';
import { createApplication } from '@/lib/applications';

let db: Db;
beforeEach(async () => { db = await createDb(':memory:'); });

const CODE_ERROR = '科號必須為 15 碼（英數或空格）';

describe('courses', () => {
  it('新增後可列出，含教師', async () => {
    const c = await createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    expect(c.isActive).toBe(1);
    expect(c.teacher).toBe('王教授');
    expect((await listCourses(db)).map(x => x.code)).toEqual(['11510EECS200101']);
  });

  it('代碼重複拋錯', async () => {
    await createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    await expect(createCourse(db, { code: '11510EECS200101', name: '線代', teacher: '李教授', time: 'M1M2' })).rejects.toThrow('課程代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', async () => {
    await createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    await createCourse(db, { code: '11510MATH200102', name: '線代', teacher: '李教授', time: 'M1M2' });
    await setCourseActive(db, '11510EECS200101', false);
    expect((await listActiveCourses(db)).map(x => x.code)).toEqual(['11510MATH200102']);
    expect((await listCourses(db)).map(x => x.code)).toEqual(['11510EECS200101', '11510MATH200102']);
  });

  it('科號非 15 碼拋錯', async () => {
    await expect(createCourse(db, { code: 'C001', name: 'x', teacher: 'y', time: 'M1M2' })).rejects.toThrow(CODE_ERROR);
  });

  it('科號含 -（雖 15 碼）拋錯', async () => {
    await expect(createCourse(db, { code: '11510-EECS-2001', name: 'x', teacher: 'y', time: 'M1M2' })).rejects.toThrow(CODE_ERROR);
  });

  it('科號含中文（雖 15 碼）拋錯', async () => {
    await expect(createCourse(db, { code: '中文課號測試中文課號測試中文課', name: 'x', teacher: 'y', time: 'M1M2' })).rejects.toThrow(CODE_ERROR);
  });

  it('科號可含空格補位（校方格式）', async () => {
    const c = await createCourse(db, { code: '11510AIA 500700', name: '實體人工智慧', teacher: '陽明交大', time: 'T5T6T7' });
    expect(c.code).toBe('11510AIA 500700');
    expect(c.nameEn).toBe('');
    expect((await listCourses(db))[0].code).toBe('11510AIA 500700');
  });

  it('科號含兩個空格也保留', async () => {
    await createCourse(db, { code: '11510CS  110400', name: '關鍵科技探索', teacher: '磨課師', time: 'Mn', nameEn: 'Key Technology' });
    const [c] = await listCourses(db);
    expect(c.code).toBe('11510CS  110400');
    expect(c.nameEn).toBe('Key Technology');
  });

  it('科號首尾空格拋錯', async () => {
    await expect(createCourse(db, { code: ' 1510CS  110400', name: 'x', teacher: 'y', time: 'M1M2' })).rejects.toThrow(CODE_ERROR);
    await expect(createCourse(db, { code: '11510CS  11040 ', name: 'x', teacher: 'y', time: 'M1M2' })).rejects.toThrow(CODE_ERROR);
  });

  it('上課時間空白拋錯', async () => {
    await expect(createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: '  ' })).rejects.toThrow('上課時間為必填');
  });

  it('新增後 time 可讀回', async () => {
    await createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'T1T2R1R2' });
    expect((await listCourses(db))[0].time).toBe('T1T2R1R2');
  });
});

describe('deleteCourses', () => {
  const B1 = '11510EECS200101';
  const B2 = '11510MATH200102';
  const B3 = '11510PHYS200103';
  beforeEach(async () => {
    for (const code of [B1, B2, B3]) await createCourse(db, { code, name: '課程', teacher: '教授', time: 'M1M2' });
  });

  it('可一次刪除多筆', async () => {
    expect(await deleteCourses(db, [B1, B3])).toEqual({ deleted: [B1, B3], inUse: [] });
    expect((await listCourses(db)).map(x => x.code)).toEqual([B2]);
  });

  it('已有申請單的課程略過不刪，其餘照常刪除', async () => {
    await createApplication(db, {
      studentId: '113000001', studentName: '王小明', department: '資訊工程學系', degree: '大學部',
      coursesA: [{ code: 'EE2010', name: '電路學', time: 'M3M4', teacher: '林教授' }], courseBCode: B2,
    });
    expect(await deleteCourses(db, [B1, B2, B3])).toEqual({ deleted: [B1, B3], inUse: [B2] });
    expect((await listCourses(db)).map(x => x.code)).toEqual([B2]);
  });

  it('空清單、重複或不存在的科號不出錯', async () => {
    expect(await deleteCourses(db, [])).toEqual({ deleted: [], inUse: [] });
    expect(await deleteCourses(db, [B1, B1, '11510NONE000000'])).toEqual({ deleted: [B1], inUse: [] });
  });
});
