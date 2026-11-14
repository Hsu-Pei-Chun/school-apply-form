import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/apply' }));
vi.mock('@/app/login/actions', () => ({ logoutAction: vi.fn() }));
vi.mock('@/app/locale-actions', () => ({ setLocaleAction: vi.fn() }));

const { default: Nav } = await import('@/components/Nav');
const { default: SiteFooter } = await import('@/components/SiteFooter');

describe('Nav', () => {
  it('未登入只顯示學生申請，不露出管理頁連結', () => {
    const html = renderToStaticMarkup(<Nav isAdmin={false} locale="zh" />);
    expect(html).toContain('href="/apply"');
    expect(html).not.toContain('href="/admin/courses"');
    expect(html).not.toContain('href="/admin/settings"');
  });

  it('管理員看得到課程管理與申請表設定', () => {
    const html = renderToStaticMarkup(<Nav isAdmin locale="zh" />);
    expect(html).toContain('href="/admin/courses"');
    expect(html).toContain('href="/admin/settings"');
  });
});

describe('SiteFooter', () => {
  it('未登入時提供管理員登入入口', () => {
    const html = renderToStaticMarkup(<SiteFooter isAdmin={false} locale="zh" />);
    expect(html).toContain('href="/login?next=%2Fadmin%2Fcourses"');
    expect(html).toContain('管理員登入');
  });

  it('已登入不再顯示登入入口', () => {
    expect(renderToStaticMarkup(<SiteFooter isAdmin locale="en" />)).not.toContain('/login');
  });
});
