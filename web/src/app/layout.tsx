import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スポット探索マップ",
  description: "地図を動かしながら周辺のスポットを探せるアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
