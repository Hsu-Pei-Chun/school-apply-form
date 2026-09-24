import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { getFormSettings } from '@/lib/form-settings';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = dict(locale).settings;
  const initial = await getFormSettings(await getDb());
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-2 text-muted-fg">{t.intro}</p>
      <p className="mb-6 text-sm text-muted-fg">{t.persistNote}</p>
      <Card><SettingsForm initial={initial} locale={locale} /></Card>
    </>
  );
}
