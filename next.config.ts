import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // حزم ذات روابط أصلية (napi) يجب إبقاؤها خارج حزمة البناء لتعمل على Vercel
  serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
  // مسموح أصول التطوير: معاينة المنصة داخل المتصفح عبر نطاقها
  allowedDevOrigins: ["*.space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
