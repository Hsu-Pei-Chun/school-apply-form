'use client';

import Button from '@/components/Button';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';

export type CourseARow = { key: number; code: string; name: string; time: string; teacher: string };
const FIELDS: Array<keyof Omit<CourseARow, 'key'>> = ['code', 'name', 'time', 'teacher'];

type Props = { rows: CourseARow[]; max: number; onChange: (rows: CourseARow[]) => void; locale: Locale };

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
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{t.courseALegend(max)}</legend>
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-[var(--radius-card)] border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-fg">{t.courseANth(i + 1)}</span>
            <Button type="button" variant="danger" className="min-h-11 px-3 text-xs" onClick={() => remove(i)} disabled={rows.length <= 1} aria-label={t.removeNth(i + 1)}>
              <TrashIcon className="size-4" /> {t.remove}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(f => {
              const id = `courseA-${i}-${f}`;
              const { label, hint } = t.courseAFields[f];
              return (
                <div key={f} className="flex flex-col gap-1.5">
                  <label htmlFor={id} className="text-sm font-medium">{label}</label>
                  <input id={id} name={`courseA[${i}][${f}]`} className="input" required maxLength={100} value={r[f]} onChange={e => update(i, f, e.target.value)} placeholder={hint} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} disabled={rows.length >= max} className="self-start">
        <PlusIcon className="size-4" /> {t.add}
      </Button>
    </fieldset>
  );
}
