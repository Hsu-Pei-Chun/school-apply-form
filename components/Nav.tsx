'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { logoutAction } from '@/app/login/actions';
import { setLocaleAction } from '@/app/locale-actions';
import { dict, Locale } from '@/lib/i18n';

const LINK = 'min-h-11 inline-flex items-center rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10';

export default function Nav({ isAdmin, locale }: { isAdmin: boolean; locale: Locale }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const t = dict(locale).site;
  const links = [
    { href: '/apply', label: t.navApply },
    { href: '/admin/courses', label: t.navCourses },
    ...(isAdmin ? [{ href: '/admin/settings', label: t.navSettings }] : []),
  ];
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="min-h-11 inline-flex items-center text-lg font-semibold tracking-wide">{t.brand}</Link>
        <nav aria-label={t.navLabel} className="flex flex-wrap items-center gap-1">
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`${LINK} ${active ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            );
          })}
          <button type="button" lang={locale === 'zh' ? 'en' : 'zh-Hant'} aria-label={t.switchLabel} disabled={pending}
            onClick={() => startTransition(() => setLocaleAction(locale === 'zh' ? 'en' : 'zh'))}
            className={`${LINK} cursor-pointer border border-white/30 disabled:opacity-60`}>
            {t.switchTo}
          </button>
          {isAdmin && (
            <form action={logoutAction} className="ml-2 flex items-center gap-2 border-l border-white/30 pl-3 text-sm">
              <span>{t.admin}</span>
              <button type="submit" className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-2 underline-offset-2 hover:underline">{t.logout}</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
