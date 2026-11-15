import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsNumber, Max, Min, IsOptional } from 'class-validator';

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
}
