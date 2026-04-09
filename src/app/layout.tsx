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
  title: "인도 패킹리스트 클라우드 파서 | ANTIGRAVITY",
  description: "인도 패킹리스트 PDF 파일의 엑셀 변환, 구글 시트 데이터 매칭 및 수량 검증을 한 번에 해결하는 스마트 클라우드 솔루션입니다.",
  keywords: ["인도 패킹리스트", "PDF 엑셀 변환", "물류 자동화", "ANTIGRAVITY", "수량 검증"],
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
