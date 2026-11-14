'use client';

import { useState } from 'react';
import { PlusIcon, UploadIcon, XIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';
import AddCourseForm from './AddCourseForm';
import ImportCoursesForm from './ImportCoursesForm';

type Panel = 'import' | 'add' | null;

const BTN = 'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] px-4 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

// 課程列表是最常用的部分；匯入、新增不常用，收成按鈕點了才展開，列表才不會被擠到頁尾
export default function CoursesPanels({ locale }: { locale: Locale }) {
  const t = dict(locale).courses;
  const [open, setOpen] = useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>) => setOpen(o => (o === p ? null : p));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={open === 'import'} aria-controls="panel-import" onClick={() => toggle('import')}
          className={`${BTN} border ${open === 'import' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-surface text-foreground hover:bg-background'}`}>
          <UploadIcon className="size-4" /> {t.importOpen}
        </button>
        <button type="button" aria-expanded={open === 'add'} aria-controls="panel-add" onClick={() => toggle('add')}
          className={`${BTN} ${open === 'add' ? 'border border-primary bg-primary/5 text-primary' : 'bg-primary text-white hover:bg-primary-hover'}`}>
          <PlusIcon className="size-4" /> {t.addOpen}
        </button>
      </div>

      {open && (
        <section id={open === 'import' ? 'panel-import' : 'panel-add'} aria-labelledby="courses-panel-title"
          className="rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="courses-panel-title" className="text-lg font-semibold">{open === 'import' ? t.importTitle : t.addTitle}</h2>
            <button type="button" onClick={() => setOpen(null)} aria-label={t.closePanel}
              className="-my-2 -mr-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-muted-fg transition-colors duration-150 hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <XIcon />
            </button>
          </div>
          {open === 'import' ? <ImportCoursesForm locale={locale} /> : <AddCourseForm locale={locale} />}
        </section>
      )}
    </div>
  );
}
