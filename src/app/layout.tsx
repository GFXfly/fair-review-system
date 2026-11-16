import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactScan } from "@/components/ReactScan";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "招投标领域公平竞争审查辅助平台",
  description: "公平竞争智能审查辅助平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      {process.env.NODE_ENV === 'development' && <ReactScan />}
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
