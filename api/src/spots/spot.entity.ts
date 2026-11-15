import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Point } from 'typeorm';

// インデックス（source_idのユニーク、locationのGiST）はマイグレーションで定義している
@Entity({ name: 'spots' })
export class Spot {
  @PrimaryGeneratedColumn()
  id: number;

  /** シードデータ側のID。再インポート時の重複防止（UPSERTのキー）に使う */
  @Column({ name: 'source_id', type: 'varchar', length: 64 })
  sourceId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /**
   * 位置情報。geography型にすることで、距離計算・半径検索をメートル単位で
   * 正確に（地球の曲率を考慮して）行える。GiSTインデックスで半径検索を高速化。
   */
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: Point;

  /** CSVの上記以外の列。列が増減してもスキーマ変更なしで保持できるようにする */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, string>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
