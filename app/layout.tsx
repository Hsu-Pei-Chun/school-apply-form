import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getCurrentStudent } from "@/lib/auth";

export const metadata: Metadata = {
  title: "課程申請表系統",
  description: "學生登入後申請 X-Class 課程、列印含條碼申請表；行政掃描收件",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = await getCurrentStudent();
  return (
    <html lang="zh-Hant">
      <body>
        <Nav user={s ? { id: s.id, name: s.name } : null} />
        <main className="container-narrow">{children}</main>
      </body>
    </html>
  );
}
