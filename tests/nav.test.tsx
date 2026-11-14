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

describe('Nav（手機）', () => {
  it('管理員：手機上顯示選單按鈕（預設收合），連結列只在 md 以上顯示', () => {
    const html = renderToStaticMarkup(<Nav isAdmin locale="zh" />);
    const btn = html.match(/<button[^>]*aria-label="開啟選單"[^>]*>/)?.[0];
    expect(btn).toBeDefined();
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('md:hidden');
    expect(html).toMatch(/<nav[^>]*class="[^"]*hidden md:flex/);
  });

  it('學生：沒有選單按鈕；語言切換在手機上縮成短標籤，無障礙名稱不變', () => {
    const html = renderToStaticMarkup(<Nav isAdmin={false} locale="zh" />);
    expect(html).not.toContain('開啟選單');
    expect(html).toMatch(/aria-label="Switch to English"/);
    expect(html).toMatch(/<span class="md:hidden">EN<\/span>/);
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
