'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { logoutAction } from '@/app/login/actions';
import { setLocaleAction } from '@/app/locale-actions';
import { MenuIcon, XIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';

const LINK = 'min-h-11 inline-flex items-center rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10 hover:text-highlight';

// 手機（md 以下）只留一行：系統名稱＋語言切換；管理員另有選單按鈕，連結與登出收進展開面板。
// 學生只有「學生申請」一個連結，手機上省略（點系統名稱回首頁就有「開始填寫」，列印頁也有「回申請頁」）。
export default function Nav({ isAdmin, locale }: { isAdmin: boolean; locale: Locale }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = dict(locale).site;

  // 換頁後收起選單
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // 管理頁只給已登入的管理員看；學生的管理員入口在頁尾（SiteFooter）
  const links = [
    { href: '/apply', label: t.navApply },
    ...(isAdmin ? [
      { href: '/admin/courses', label: t.navCourses },
      { href: '/admin/settings', label: t.navSettings },
      { href: '/admin/syllabus', label: t.navSyllabus },
    ] : []),
  ];
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="bg-primary text-white" onKeyDown={e => { if (e.key === 'Escape') setMenuOpen(false); }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 md:py-3">
        <Link href="/" className="min-h-11 inline-flex min-w-0 items-center text-base font-semibold tracking-wide sm:text-lg">{t.brand}</Link>
        <div className="flex shrink-0 items-center gap-1">
          <nav aria-label={t.navLabel} className="hidden md:flex md:items-center md:gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}
                className={`${LINK} ${isActive(l.href) ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            ))}
          </nav>
          <button type="button" lang={locale === 'zh' ? 'en' : 'zh-Hant'} aria-label={t.switchLabel} disabled={pending}
            onClick={() => startTransition(() => setLocaleAction(locale === 'zh' ? 'en' : 'zh'))}
            className={`${LINK} min-w-11 cursor-pointer justify-center border border-white/30 disabled:opacity-60`}>
            <span className="md:hidden">{t.switchShort}</span>
            <span className="hidden md:inline">{t.switchTo}</span>
          </button>
          {isAdmin && (
            <form action={logoutAction} className="ml-2 hidden items-center gap-2 border-l border-white/30 pl-3 text-sm md:flex">
              <span>{t.admin}</span>
              <button type="submit" className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-2 underline-offset-2 hover:underline">{t.logout}</button>
            </form>
          )}
          {isAdmin && (
            <button type="button" aria-label={menuOpen ? t.menuClose : t.menuOpen} aria-expanded={menuOpen} aria-controls="mobile-menu"
              onClick={() => setMenuOpen(o => !o)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:hidden">
              {menuOpen ? <XIcon className="size-6" /> : <MenuIcon className="size-6" />}
            </button>
          )}
        </div>
      </div>

      {isAdmin && menuOpen && (
        <div id="mobile-menu" className="border-t border-white/20 md:hidden">
          <nav aria-label={t.navLabel} className="mx-auto flex max-w-5xl flex-col px-2 py-2">
            {links.map(l => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}
                className={`${LINK} text-base ${isActive(l.href) ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            ))}
            <form action={logoutAction} className="mt-1 flex items-center justify-between border-t border-white/20 px-3 pt-2 text-sm">
              <span className="text-white/80">{t.admin}</span>
              <button type="submit" className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-2 underline-offset-2 hover:underline">{t.logout}</button>
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
