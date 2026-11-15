import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';
import { GeocodingService } from './geocoding.service.js';

class ReverseGeocodeQuery {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

@Controller('geocode')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  /** GET /api/geocode/reverse?lat=35.68&lng=139.76 */
  @Get('reverse')
  reverse(@Query() { lat, lng }: ReverseGeocodeQuery) {
    return this.geocodingService.reverse(lat, lng);
  }
}
