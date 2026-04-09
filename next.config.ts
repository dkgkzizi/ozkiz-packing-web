import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSR 환경에서 바이너리나 Node.js 내장 모듈을 사용하는 패키지들을 위한 설정
  serverExternalPackages: ['pdf.js-extract', 'pdf2json'],
  
  // 클라이언트 사이드 라이브러리 트랜스파일 설정
  transpilePackages: ['lucide-react'],

  // 빌드 시 타입 에러와 린트 에러를 무시하도록 설정하여 배포 속도를 높임
  typescript: {
    ignoreBuildErrors: true, 
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
