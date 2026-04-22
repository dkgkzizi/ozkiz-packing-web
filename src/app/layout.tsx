import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "오즈키즈 통합 패킹리스트 변환 웹 | OZKIZ",
  description: "인도, 국내, 중국 패킹리스트 PDF/엑셀 파일을 통합 관리하고 수량을 검증하는 오즈키즈 물류 자동화 솔루션입니다.",
  keywords: ["오즈키즈", "패킹리스트 변환", "물류 자동화", "인도 패킹", "중국 패킹", "국내 패킹", "OZKIZ"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
