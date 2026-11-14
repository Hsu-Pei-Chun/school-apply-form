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
  const [lens, setLens] = useState<Partial<Record<keyof FormSettingsInput, number>>>({});

  function apply(r: Awaited<ReturnType<typeof saveSettings>>) {
    if (!r.ok) { setMessage({ kind: 'error', text: r.error }); return; }
    setValues(r.values);
    setLens({});
    setVersion(v => v + 1);
    setMessage({ kind: 'ok', text: t.saved });
  }

  // 同意事項＋送交說明的建議字數上限（實測：超過時一般內容量的申請表就可能印成兩頁）；英文字較窄，上限放寬
  const langs = [
    { suffix: 'Zh', label: t.zh, lang: 'zh-Hant', limit: 600 },
    { suffix: 'En', label: t.en, lang: 'en', limit: 1200 },
  ] as const;
  const len = (name: keyof FormSettingsInput) => lens[name] ?? values[name].length;
  const track = (name: keyof FormSettingsInput) => (e: { target: { value: string } }) => setLens(l => ({ ...l, [name]: e.target.value.length }));

  return (
    <form key={version} action={fd => { setMessage(null); startTransition(async () => apply(await saveSettings(fd))); }} className="flex flex-col gap-6">
      {langs.map(({ suffix, label, lang, limit }) => {
        const total = len(`terms${suffix}`) + len(`submitNote${suffix}`);
        const over = total > limit;
        return (
          <fieldset key={suffix} className="flex flex-col gap-3" lang={lang}>
            <legend className="mb-1 text-base font-semibold">{label}</legend>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`terms${suffix}`} className="text-sm font-medium">{t.terms}</label>
              <textarea id={`terms${suffix}`} name={`terms${suffix}`} className="input min-h-36 py-2" required
                defaultValue={values[`terms${suffix}`]} onChange={track(`terms${suffix}`)} aria-describedby={`length${suffix}`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`submitNote${suffix}`} className="text-sm font-medium">{t.submitNote}</label>
              <textarea id={`submitNote${suffix}`} name={`submitNote${suffix}`} className="input min-h-20 py-2"
                defaultValue={values[`submitNote${suffix}`]} onChange={track(`submitNote${suffix}`)} aria-describedby={`length${suffix}`} />
            </div>
            <p id={`length${suffix}`} aria-live="polite"
              className={`text-sm ${over ? 'rounded-[var(--radius-card)] bg-warning-bg px-3 py-2 text-warning' : 'text-muted-fg'}`}>
              {t.lengthHint(total, limit)}{over && <> {t.lengthOver}</>}
            </p>
          </fieldset>
        );
      })}

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
