'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';

const LINKS = [
  { href: '/apply', label: '學生申請' },
  { href: '/admin/courses', label: '課程管理' },
];

export default function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="min-h-11 inline-flex items-center text-lg font-semibold tracking-wide">國立○○大學 課程申請表系統</Link>
        <nav aria-label="主選單" className="flex flex-wrap items-center gap-1">
          {LINKS.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={`min-h-11 inline-flex items-center rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10 ${active ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            );
          })}
          {isAdmin && (
            <form action={logoutAction} className="ml-2 flex items-center gap-2 border-l border-white/30 pl-3 text-sm">
              <span>管理員</span>
              <button type="submit" className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-2 underline-offset-2 hover:underline">登出</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
