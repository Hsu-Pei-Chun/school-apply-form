'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/apply', label: '學生申請' },
  { href: '/admin/courses', label: '課程管理' },
  { href: '/admin/scan', label: '掃描收件' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-wide">國立○○大學 課程申請表系統</Link>
        <nav aria-label="主選單" className="flex gap-1">
          {LINKS.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10 ${active ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
