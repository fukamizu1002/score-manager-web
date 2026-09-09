import "./globals.css";
export const metadata = { title: "過去問成績管理アプリ" };
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
