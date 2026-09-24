'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import { dict, Locale } from '@/lib/i18n';
import type { FormSettingsInput } from '@/lib/form-settings';
import { saveSettings, resetSettings } from './actions';

export default function SettingsForm({ initial, locale }: { initial: FormSettingsInput; locale: Locale }) {
  const t = dict(locale).settings;
  const [values, setValues] = useState(initial);
  // key 變動時讓 textarea 重新掛載，以顯示儲存後正規化（去空行）或還原後的內容
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(r: Awaited<ReturnType<typeof saveSettings>>) {
    if (!r.ok) { setMessage({ kind: 'error', text: r.error }); return; }
    setValues(r.values);
    setVersion(v => v + 1);
    setMessage({ kind: 'ok', text: t.saved });
  }

  const langs = [
    { suffix: 'Zh', label: t.zh, lang: 'zh-Hant' },
    { suffix: 'En', label: t.en, lang: 'en' },
  ] as const;

  return (
    <form key={version} action={fd => { setMessage(null); startTransition(async () => apply(await saveSettings(fd))); }} className="flex flex-col gap-6">
      {langs.map(({ suffix, label, lang }) => (
        <fieldset key={suffix} className="flex flex-col gap-3" lang={lang}>
          <legend className="mb-1 text-base font-semibold">{label}</legend>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`terms${suffix}`} className="text-sm font-medium">{t.terms}</label>
            <textarea id={`terms${suffix}`} name={`terms${suffix}`} className="input min-h-36 py-2" required
              defaultValue={values[`terms${suffix}`]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`submitNote${suffix}`} className="text-sm font-medium">{t.submitNote}</label>
            <textarea id={`submitNote${suffix}`} name={`submitNote${suffix}`} className="input min-h-20 py-2"
              defaultValue={values[`submitNote${suffix}`]} />
          </div>
        </fieldset>
      ))}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-[var(--radius-card)] px-3 py-2 text-sm ${message.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={pending}>{t.save}</Button>
        <Button type="button" variant="secondary" disabled={pending}
          onClick={() => { setMessage(null); startTransition(async () => apply(await resetSettings())); }}>
          {t.reset}
        </Button>
      </div>
    </form>
  );
}
