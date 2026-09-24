'use client';

import Link from 'next/link';
import Button from '@/components/Button';
import { PrinterIcon, ArrowLeftIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';

export default function PrintToolbar({ locale = 'zh' }: { locale?: Locale }) {
  const t = dict(locale).print;
  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex items-center justify-between gap-2 bg-background py-2">
      <Link href="/apply" className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary hover:underline">
        <ArrowLeftIcon className="size-4" /> {t.back}
      </Link>
      <Button variant="primary" onClick={() => window.print()}><PrinterIcon /> {t.print}</Button>
    </div>
  );
}
