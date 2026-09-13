import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "課程申請表系統",
  description: "學生申請科目、列印含條碼申請表、行政掃描收件",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
      </body>
    </html>
  );
}
