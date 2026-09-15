import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses, listActiveCourses, setCourseActive } from '@/lib/courses';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('courses', () => {
  it('新增後可列出，含教師', () => {
    const c = createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    expect(c.isActive).toBe(1);
    expect(c.teacher).toBe('王教授');
    expect(listCourses(db).map(x => x.code)).toEqual(['11510EECS200101']);
  });

  it('代碼重複拋錯', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    expect(() => createCourse(db, { code: '11510EECS200101', name: '線代', teacher: '李教授', time: 'M1M2' })).toThrow('課程代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'M1M2' });
    createCourse(db, { code: '11510MATH200102', name: '線代', teacher: '李教授', time: 'M1M2' });
    setCourseActive(db, '11510EECS200101', false);
    expect(listActiveCourses(db).map(x => x.code)).toEqual(['11510MATH200102']);
    expect(listCourses(db).map(x => x.code)).toEqual(['11510EECS200101', '11510MATH200102']);
  });

  it('科號非 15 碼拋錯', () => {
    expect(() => createCourse(db, { code: 'C001', name: 'x', teacher: 'y', time: 'M1M2' })).toThrow('科號必須為 15 碼（英數或空格）');
  });

  it('科號含 -（雖 15 碼）拋錯', () => {
    expect(() => createCourse(db, { code: '11510-EECS-2001', name: 'x', teacher: 'y', time: 'M1M2' })).toThrow('科號必須為 15 碼（英數或空格）');
  });

  it('科號含中文（雖 15 碼）拋錯', () => {
    expect(() => createCourse(db, { code: '中文課號測試中文課號測試中文課', name: 'x', teacher: 'y', time: 'M1M2' })).toThrow('科號必須為 15 碼（英數或空格）');
  });

  it('科號可含空格補位（校方格式）', () => {
    const c = createCourse(db, { code: '11510AIA 500700', name: '實體人工智慧', teacher: '陽明交大', time: 'T5T6T7' });
    expect(c.code).toBe('11510AIA 500700');
    expect(c.nameEn).toBe('');
    expect(listCourses(db)[0].code).toBe('11510AIA 500700');
  });

  it('科號含兩個空格也保留', () => {
    createCourse(db, { code: '11510CS  110400', name: '關鍵科技探索', teacher: '磨課師', time: 'Mn', nameEn: 'Key Technology' });
    expect(listCourses(db)[0].code).toBe('11510CS  110400');
    expect(listCourses(db)[0].nameEn).toBe('Key Technology');
  });

  it('上課時間空白拋錯', () => {
    expect(() => createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: '  ' })).toThrow('上課時間為必填');
  });

  it('新增後 time 可讀回', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'T1T2R1R2' });
    expect(listCourses(db)[0].time).toBe('T1T2R1R2');
  });
});
