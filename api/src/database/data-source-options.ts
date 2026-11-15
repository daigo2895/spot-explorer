import type { DataSourceOptions } from 'typeorm';
import { Spot } from '../spots/spot.entity.js';
import { CreateSpots1731600000000 } from './migrations/1731600000000-CreateSpots.js';

/**
 * アプリ本体とシード処理（CLI）の両方から使う接続設定。
 * エンティティ・マイグレーションはglobではなくクラスを直接指定している。
 * （ESMのビルド成果物でもパス解決の差異が出ないようにするため）
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'spots',
    entities: [Spot],
    migrations: [CreateSpots1731600000000],
    // スキーマはマイグレーションで管理する。synchronize は本番事故の元なので使わない
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  };
}
