import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course } from '@/lib/db/schema';

vi.mock('@/app/admin/courses/actions', () => ({
  deleteSelectedCourses: vi.fn(), toggleCourse: vi.fn(), addCourse: vi.fn(), previewImport: vi.fn(), confirmImport: vi.fn(),
}));

const { default: CourseARows } = await import('@/app/apply/CourseARows');
const { default: CoursesTable } = await import('@/app/admin/courses/CoursesTable');
const { default: CoursesPanels } = await import('@/app/admin/courses/CoursesPanels');

const row = (key: number) => ({ key, code: '', name: '', time: '', teacher: '' });

describe('CourseARows', () => {
  it('只有一門時不顯示刪除鈕', () => {
    const html = renderToStaticMarkup(<CourseARows rows={[row(1)]} max={5} onChange={() => {}} locale="zh" />);
    expect(html).not.toContain('刪除第 1 門');
  });

  it('多門時刪除鈕為灰色圖示按鈕（不再是紅框），保留 aria-label 與 44px 觸控區', () => {
    const html = renderToStaticMarkup(<CourseARows rows={[row(1), row(2)]} max={5} onChange={() => {}} locale="zh" />);
    const btn = html.match(/<button[^>]*aria-label="刪除第 2 門"[^>]*>/)?.[0];
    expect(btn).toBeDefined();
    expect(btn).toContain('size-11');
    expect(btn).toContain('text-muted-fg');
    expect(btn).not.toContain('border-danger');
  });
});

const course = (code: string, isActive: number): Course => ({
  code, name: `課程${code.slice(-1)}`, nameEn: '', teacher: '王教授', time: 'M1M2', note: '', isActive, createdAt: '2026-11-01T00:00:00.000Z',
});
const rows = [course('11510AIA 500701', 1), course('11510AIA 500702', 1), course('11510AIA 500703', 0)];

describe('CoursesTable', () => {
  it('列表上方有搜尋框與 全部／啟用／停用 篩選（附筆數）', () => {
    const html = renderToStaticMarkup(<CoursesTable rows={rows} locale="zh" />);
    expect(html).toContain('type="search"');
    expect(html).toContain('全部（3）');
    expect(html).toContain('啟用（2）');
    expect(html).toContain('停用（1）');
    expect(html).toMatch(/aria-pressed="true"[^>]*>全部（3）/);
  });

  it('開放申請改為開關（role=switch），停用不再用紅色', () => {
    const html = renderToStaticMarkup(<CoursesTable rows={rows} locale="zh" />);
    expect(html.match(/role="switch"/g)).toHaveLength(3);
    expect(html).toMatch(/role="switch" aria-checked="false" aria-label="11510AIA 500703 開放申請"/);
    expect(html).not.toContain('border-danger/40');
  });
});

describe('CoursesPanels', () => {
  it('批次匯入與新增課程預設收合，以按鈕展開', () => {
    const html = renderToStaticMarkup(<CoursesPanels locale="zh" />);
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*批次匯入/);
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*新增課程/);
    expect(html).not.toContain('import-text');
  });
});
