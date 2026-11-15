import { Controller, Get, Query } from '@nestjs/common';
import { SearchSpotsQuery } from './dto/search-spots.query.js';
import { SpotsService } from './spots.service.js';

@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  /** GET /api/spots?lat=35.68&lng=139.76&radiusKm=3 */
  @Get()
  search(@Query() query: SearchSpotsQuery) {
    return this.spotsService.search(query);
  }

  /** GET /api/spots/summary  件数とデータ全体の範囲（地図の初期表示用） */
  @Get('summary')
  summary() {
    return this.spotsService.summary();
  }
}
