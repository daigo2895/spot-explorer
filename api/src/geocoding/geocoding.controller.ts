import { Controller, Get, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsString, MaxLength, MinLength } from 'class-validator';
import { GeocodingService } from './geocoding.service.js';

class ReverseGeocodeQuery {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

class GeocodeSearchQuery {
  /** 地名・住所・施設名 */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;
}

@Controller('geocode')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  /** GET /api/geocode/reverse?lat=35.68&lng=139.76 */
  @Get('reverse')
  reverse(@Query() { lat, lng }: ReverseGeocodeQuery) {
    return this.geocodingService.reverse(lat, lng);
  }

  /** GET /api/geocode/search?q=浅草  地名・住所 → 候補（最大5件） */
  @Get('search')
  search(@Query() { q }: GeocodeSearchQuery) {
    return this.geocodingService.search(q);
  }
}
