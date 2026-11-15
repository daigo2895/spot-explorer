import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpots1731600000000 implements MigrationInterface {
  name = 'CreateSpots1731600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`
      CREATE TABLE "spots" (
        "id" SERIAL PRIMARY KEY,
        "source_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "category" varchar(100),
        "address" text,
        "location" geography(Point, 4326) NOT NULL,
        "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_spots_source_id" ON "spots" ("source_id")`,
    );
    // 半径検索（ST_DWithin）で使う空間インデックス
    await queryRunner.query(
      `CREATE INDEX "idx_spots_location" ON "spots" USING GIST ("location")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "spots"`);
  }
}
