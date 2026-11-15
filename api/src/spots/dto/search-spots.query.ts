import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_RADIUS_KM = 100;

export class SearchSpotsQuery {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  /** 検索半径(km)。極端に大きい値で全件スキャンにならないよう上限を設ける */
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(MAX_RADIUS_KM)
  radiusKm: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 500;

  /**
   * 絞り込むカテゴリ（カンマ区切り。例: categories=寺院,神社）。省略時は全カテゴリ。
   * 同じキーを複数回指定した場合（categories=寺院&categories=神社）も受け付ける
   */
  @IsOptional()
  @Transform(({ value }) =>
    (Array.isArray(value) ? value : [String(value)])
      .flatMap((v: string) => v.split(','))
      .map((v: string) => v.trim())
      .filter((v: string) => v !== ''),
  )
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  categories?: string[];
}
