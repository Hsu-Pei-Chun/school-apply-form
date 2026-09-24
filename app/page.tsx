import Link from 'next/link';
import Card from '@/components/Card';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';

export default async function Home() {
  const t = dict(await getLocale()).home;
  const items = [
    { href: '/apply', title: t.applyTitle, desc: t.applyDesc },
    { href: '/admin/courses', title: t.coursesTitle, desc: t.coursesDesc },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="block">
          <Card className="transition-colors duration-150 hover:bg-background">
            <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-fg">{item.desc}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
