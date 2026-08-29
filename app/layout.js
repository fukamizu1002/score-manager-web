import "./globals.css";

export const metadata = {
  title: "過去問・成績管理",
  description: "過去問・提出・復習ノート・成績分析を一括管理"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
