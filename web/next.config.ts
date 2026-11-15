import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker イメージを小さくするため、実行に必要なファイルだけを .next/standalone に出力する
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
