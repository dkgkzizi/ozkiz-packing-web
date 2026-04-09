/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 타입 에러와 린트 에러를 무시하도록 설정합니다.
  typescript: {
    ignoreBuildErrors: true, 
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
