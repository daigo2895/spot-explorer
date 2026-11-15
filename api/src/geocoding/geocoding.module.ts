import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeocodingController } from './geocoding.controller.js';
import { GeocodingService } from './geocoding.service.js';
import { GoogleGeocoder } from './providers/google.geocoder.js';
import { NominatimGeocoder } from './providers/nominatim.geocoder.js';
import { REVERSE_GEOCODER, type ReverseGeocoder } from './providers/reverse-geocoder.js';

@Module({
  controllers: [GeocodingController],
  providers: [
    GeocodingService,
    {
      provide: REVERSE_GEOCODER,
      inject: [ConfigService],
      // APIキーがあれば Google、なければキー不要の Nominatim を使う。
      // 評価者が APIキーなしで docker-compose up しても動くようにするため。
      useFactory: (config: ConfigService): ReverseGeocoder => {
        const googleKey = config.get<string>('GOOGLE_MAPS_API_KEY');
        const geocoder: ReverseGeocoder = googleKey
          ? new GoogleGeocoder(googleKey)
          : new NominatimGeocoder(
              config.get<string>(
                'NOMINATIM_USER_AGENT',
                'spot-explorer/1.0',
              ),
              config.get<string>('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
            );
        new Logger('GeocodingModule').log(`reverse geocoder: ${geocoder.name}`);
        return geocoder;
      },
    },
  ],
})
export class GeocodingModule {}
