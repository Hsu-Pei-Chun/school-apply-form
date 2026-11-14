'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/Button';
import { PrinterIcon, ArrowLeftIcon, DownloadIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';
import { downloadSheetPdf, pdfFilename } from '@/lib/pdf-export';

export default function PrintToolbar({ locale = 'zh', barcode = '' }: { locale?: Locale; barcode?: string }) {
  const t = dict(locale).print;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPdf() {
    const sheet = document.querySelector<HTMLElement>('.sheet');
    if (!sheet) return;
    setBusy(true);
    setError('');
    try {
      await downloadSheetPdf(sheet, pdfFilename(t.pdfFilename, barcode));
    } catch (e) {
      console.error(e);
      setError(t.pdfError);
    } finally {
      setBusy(false);
    }
  }

  // 學生最常漏掉「簽章、送交」，所以工具列同時是「下一步」說明卡
  return (
    <div className="no-print mb-6 flex flex-col gap-2">
      <Link href="/apply" className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-secondary hover:underline">
        <ArrowLeftIcon className="size-4" /> {t.back}
      </Link>
      <section aria-labelledby="next-title" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="next-title" className="text-lg font-semibold text-primary">{t.nextTitle}</h2>
          {barcode && <p className="text-sm text-muted-fg">{t.barcode}　<span className="font-mono whitespace-pre text-foreground">{barcode}</span></p>}
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {t.nextSteps.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
              <span className="leading-6">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
          <Button variant="primary" onClick={() => window.print()}><PrinterIcon /> {t.print}</Button>
          <Button variant="secondary" onClick={onPdf} loading={busy}>
            {!busy && <DownloadIcon />} {busy ? t.pdfBusy : t.pdf}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-fg">{t.pdfHint}</p>
        )}
      </section>
    </div>
  );
}
