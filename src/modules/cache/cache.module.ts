import { Module, DynamicModule, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheOptionsInterface } from './interfaces/cache-options.interface';
import { CACHE_OPTIONS_TOKEN } from './cache.constants';

@Global()
@Module({})
export class CacheModule {
    static forRoot(options?: CacheOptionsInterface): DynamicModule {
        const optionsProvider = {
            provide: CACHE_OPTIONS_TOKEN,
            useValue: options || {},
        };

        return {
            module: CacheModule,
            providers: [
                optionsProvider,
                CacheService,
            ],
            exports: [CacheService],
            global: true,
        };
    }
}