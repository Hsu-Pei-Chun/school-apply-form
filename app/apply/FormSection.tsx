import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/icons';

type Props = { id: string; n: number; done: boolean; title: string; sub?: string; children: ReactNode };

// 申請表的編號區段卡：完成時編號換成綠色勾勾
export default function FormSection({ id, n, done, title, sub, children }: Props) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white transition-colors duration-150 ${done ? 'bg-success' : 'bg-primary'}`}>
          {done ? <CheckIcon className="size-4 stroke-[2.5]" /> : n}
        </span>
        <div className="flex flex-col">
          <h2 id={`${id}-title`} className="text-lg font-semibold leading-7">{title}</h2>
          {sub && <p className="text-sm text-muted-fg">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
