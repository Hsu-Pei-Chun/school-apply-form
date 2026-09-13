'use client';

import Link from 'next/link';
import Button from '@/components/Button';
import { PrinterIcon, ArrowLeftIcon } from '@/components/icons';

export default function PrintToolbar() {
  return (
    <div className="no-print mb-4 flex items-center justify-between gap-2">
      <Link href="/apply" className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary hover:underline">
        <ArrowLeftIcon className="size-4" /> 回申請頁
      </Link>
      <Button variant="primary" onClick={() => window.print()}><PrinterIcon /> 列印申請表</Button>
    </div>
  );
}
