import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "課程申請表系統",
  description: "學生填寫資料申請 X-Class 課程、列印含條碼申請表",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <Nav isAdmin={await isAdmin()} />
        <main className="container-narrow">{children}</main>
      </body>
    </html>
  );
}
