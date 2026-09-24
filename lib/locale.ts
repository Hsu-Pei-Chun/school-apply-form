import 'server-only';
import { cookies } from 'next/headers';
import { Locale, LOCALE_COOKIE, toLocale } from './i18n';

export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
