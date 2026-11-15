import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './database/data-source-options.js';
import { GeocodingModule } from './geocoding/geocoding.module.js';
import { SpotsModule } from './spots/spots.module.js';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions() }),
    SpotsModule,
    GeocodingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
