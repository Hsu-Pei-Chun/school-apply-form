import Link from 'next/link';
import Card from '@/components/Card';
import { ArrowRightIcon, CheckIcon } from '@/components/icons';
import { isAdmin } from '@/lib/admin-auth';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';

// 首頁以「流程」為主：學生進來先知道要列印、簽章、送交，才不會以為線上送出就完成
export default async function Home() {
  const t = dict(await getLocale()).home;
  const admin = await isAdmin();
  return (
    <div className="page-wide flex flex-col gap-10">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold leading-tight text-primary sm:text-4xl">{t.title}</h1>
          <p className="text-lg leading-relaxed text-foreground/80">
            {t.lead}<strong className="font-semibold text-foreground">{t.leadStrong}</strong>
          </p>
          <Link href="/apply"
            className="mt-2 inline-flex min-h-12 items-center gap-2 self-start rounded-[var(--radius-card)] bg-primary px-6 font-semibold text-white
              transition-colors duration-150 hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
            {t.start} <ArrowRightIcon className="size-5" />
          </Link>
        </div>
        <Card>
          <h2 className="mb-3 font-semibold">{t.prepareTitle}</h2>
          <ul className="flex flex-col gap-3">
            {t.prepare.map(item => (
              <li key={item} className="flex gap-3 text-foreground/80">
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-success" /> {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="flow-title" className="flex flex-col gap-4">
        <h2 id="flow-title" className="text-xl font-semibold">{t.flowTitle}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-5">
              <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-white">{i + 1}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-fg">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {admin && (
        <section aria-labelledby="admin-title" className="flex flex-col gap-4">
          <h2 id="admin-title" className="text-xl font-semibold">{t.adminTitle}</h2>
          <Link href="/admin/courses" className="group block sm:max-w-sm">
            <Card className="transition-colors duration-150 group-hover:border-primary">
              <h3 className="flex items-center justify-between font-semibold">
                {t.coursesTitle} <ArrowRightIcon className="size-4 text-muted-fg group-hover:text-primary" />
              </h3>
              <p className="mt-1 text-sm text-muted-fg">{t.coursesDesc}</p>
            </Card>
          </Link>
        </section>
      )}
    </div>
  );
}
