'use client';

import { PlusIcon, TrashIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';

export type CourseARow = { key: number; code: string; name: string; time: string; teacher: string };
export const COURSE_A_FIELDS: Array<keyof Omit<CourseARow, 'key'>> = ['code', 'name', 'time', 'teacher'];

type Props = { rows: CourseARow[]; max: number; onChange: (rows: CourseARow[]) => void; locale: Locale };

// md 以上：每門課一列、四欄並排（上方一列欄位標題）；手機：每門一張小卡、欄位兩兩排列
const GRID = 'md:grid-cols-[1.75rem_minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_2.75rem]';

export default function CourseARows({ rows, max, onChange, locale }: Props) {
  const t = dict(locale).apply;
  function update(i: number, f: keyof Omit<CourseARow, 'key'>, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [f]: v } : r)));
  }
  function add() {
    if (rows.length >= max) return;
    onChange([...rows, { key: Date.now(), code: '', name: '', time: '', teacher: '' }]);
  }
  function remove(i: number) {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className={`hidden gap-2 text-sm font-medium text-muted-fg md:grid ${GRID}`}>
        <span>#</span>
        {COURSE_A_FIELDS.map(f => <span key={f}>{t.courseAFields[f].label}</span>)}
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className={`relative grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-border bg-background/60 p-3
          md:items-center md:gap-2 md:border-0 md:bg-transparent md:p-0 ${GRID}`}>
          <span className="col-span-2 flex min-h-11 items-center text-sm font-medium text-muted-fg md:col-span-1 md:min-h-0">
            <span className="md:hidden">{t.courseANth(i + 1)}</span>
            <span className="hidden md:inline">{i + 1}</span>
          </span>
          {COURSE_A_FIELDS.map(f => {
            const id = `courseA-${i}-${f}`;
            const { label, hint } = t.courseAFields[f];
            return (
              <div key={f} className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={id} className="text-sm font-medium md:sr-only">{label}</label>
                <input id={id} name={`courseA[${i}][${f}]`} className={`input min-w-0 ${f === 'code' || f === 'time' ? 'font-mono' : ''}`}
                  required maxLength={100} value={r[f]} onChange={e => update(i, f, e.target.value)} placeholder={hint} />
              </div>
            );
          })}
          <div className="absolute right-1 top-1 md:static">
            {/* 灰色圖示鈕，hover 才轉紅；只剩一門時不顯示 */}
            {rows.length > 1 && (
              <button type="button" onClick={() => remove(i)} aria-label={t.removeNth(i + 1)} title={t.remove}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-muted-fg
                  transition-colors duration-150 hover:bg-danger-bg hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <TrashIcon className="size-5" />
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={add} disabled={rows.length >= max}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-[var(--radius-card)] border border-dashed border-muted-fg/60 bg-surface px-4 font-medium text-primary
          transition-colors duration-150 hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
          disabled:cursor-not-allowed disabled:opacity-50">
        <PlusIcon className="size-4" /> {t.add}
      </button>
    </div>
  );
}
