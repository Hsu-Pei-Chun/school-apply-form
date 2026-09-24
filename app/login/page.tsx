import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { isAdmin, isAdminConfigured } from '@/lib/admin-auth';
import { safeNext } from '@/lib/admin-auth-core';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await isAdmin()) redirect(next);
  const locale = await getLocale();
  const t = dict(locale).login;
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-muted-fg">{t.intro}</p>
      <Card>
        {isAdminConfigured()
          ? <LoginForm next={next} locale={locale} />
          : <p role="alert" className="text-sm text-danger">{t.notConfigured}</p>}
      </Card>
    </>
  );
}
