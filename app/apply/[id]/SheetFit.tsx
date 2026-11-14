'use client';

import { useEffect, useState } from 'react';
import { dict, Locale } from '@/lib/i18n';

export type Fit = 'normal' | 'dense' | 'overflow';

/** 以 A4 版面（.pdf-mode，與列印同尺寸）排一份畫面外的複本，量出內容高度是否放得進一頁。 */
export function measureFit(sheet: HTMLElement): Fit {
  const ruler = document.createElement('div');
  ruler.style.cssText = 'position:absolute;left:-10000px;top:0;height:297mm;width:1px';
  document.body.appendChild(ruler);
  const pageHeight = ruler.getBoundingClientRect().height;
  ruler.remove();

  const fits = (dense: boolean) => {
    const c = sheet.cloneNode(true) as HTMLElement;
    c.classList.add('pdf-mode');
    c.classList.toggle('dense', dense);
    c.style.cssText = 'position:absolute;left:-10000px;top:0;min-height:0';
    document.body.appendChild(c);
    const h = c.getBoundingClientRect().height;
    c.remove();
    return h <= pageHeight;
  };
  if (fits(false)) return 'normal';
  return fits(true) ? 'dense' : 'overflow';
}

// 內容多時自動改用緊湊版面（.dense），讓列印與下載 PDF 盡量維持一頁；仍放不下時提醒會印成多頁
export default function SheetFit({ locale }: { locale: Locale }) {
  const t = dict(locale).print;
  const [fit, setFit] = useState<Fit>('normal');

  useEffect(() => {
    let cancelled = false;
    // 字型載入後字寬才準
    document.fonts.ready.then(() => {
      const sheet = document.querySelector<HTMLElement>('.sheet');
      if (!sheet || cancelled) return;
      const f = measureFit(sheet);
      sheet.classList.toggle('dense', f !== 'normal');
      sheet.dataset.fit = f;
      setFit(f);
    });
    return () => { cancelled = true; };
  }, []);

  if (fit !== 'overflow') return null;
  return (
    <p role="status" className="no-print mb-4 rounded-[var(--radius-card)] bg-warning-bg px-4 py-3 text-sm text-warning">
      {t.overflowWarning}
    </p>
  );
}
