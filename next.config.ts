import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@libsql/client", "libsql", "bwip-js"],
  // libsql 以執行期計算的名稱載入原生模組（@libsql/<平台>，如 linux-x64-gnu），file tracing 追不到，
  // 需明確帶進 standalone 輸出，否則正式環境一 import @libsql/client 就會找不到原生模組而啟動失敗。
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@libsql/{linux,darwin,win32}-*/**"],
  },
};

export default nextConfig;
