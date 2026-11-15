import { defineConfig } from 'vitest/config';

// 実際の PostGIS を使う結合テスト用。単体テスト（vitest.config.ts）とは分け、DB がなくても npm test が動くようにする
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.int-spec.ts'],
    // 同じテーブルを使うため、ファイルを並列に実行しない
    fileParallelism: false,
    // エミュレーションで動く DB（Apple シリコン）でも時間切れにならないよう長めにする
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
