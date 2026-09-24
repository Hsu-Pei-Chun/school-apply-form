import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { isAdmin } from "@/lib/admin-auth";
import { getLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLocale()).site;
  return { title: t.title, description: t.description };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={dict(locale).htmlLang}>
      <body>
        <Nav isAdmin={await isAdmin()} locale={locale} />
        <main className="container-narrow">{children}</main>
      </body>
    </html>
  );
}
