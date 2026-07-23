import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OH! Packing | 오즈키즈 통합 패킹리스트 변환",
  description: "인도, 국내, 중국 패킹리스트 PDF/엑셀 파일을 통합 관리하고 수량을 검증하는 오즈키즈 물류 자동화 솔루션입니다.",
  keywords: ["오즈키즈", "OH! Packing", "패킹리스트 변환", "물류 자동화", "인도 패킹", "중국 패킹", "국내 패킹", "OZKIZ"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
