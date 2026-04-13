import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSR 환경에서 바이너리나 Node.js 내장 모듈을 사용하는 패키지들을 위한 설정
  serverExternalPackages: ['pdf.js-extract', 'pdf2json', 'pg'],
  
  // 클라이언트 사이드 라이브러리 트랜스파일 설정
  transpilePackages: ['lucide-react'],

  // 빌드 시 타입 에러와 린트 에러를 무시하도록 설정하여 배포 속도를 높임
  typescript: {
    ignoreBuildErrors: true, 
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Turbopack 호환성 설정 (Next.js 15/16)
  turbopack: {
    resolveAlias: {
      canvas: false,
    },
  },

  // canvas 모듈 에러 해결을 위한 webpack 설정
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    // fs, net, tls 등 브라우저 환경에서 필요 없는 모듈 무시
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
