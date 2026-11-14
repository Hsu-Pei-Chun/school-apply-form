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

  return (
    <div className="no-print sticky top-0 z-10 mb-4 bg-background py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/apply" className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary hover:underline">
          <ArrowLeftIcon className="size-4" /> {t.back}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onPdf} loading={busy}>
            {!busy && <DownloadIcon />} {busy ? t.pdfBusy : t.pdf}
          </Button>
          <Button variant="primary" onClick={() => window.print()}><PrinterIcon /> {t.print}</Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-fg">{t.pdfHint}</p>
      )}
    </div>
  );
}
