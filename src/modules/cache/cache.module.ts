import { Module, DynamicModule, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheOptionsInterface } from './interfaces/cache-options.interface';
import { CACHE_OPTIONS_TOKEN } from './cache.constants';
import { ConfigModule, ConfigService } from '@nestjs/config'; // ConfigModule, ConfigService 추가

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

    static registerAsync(options: {
        imports?: any[];
        inject?: any[];
        useFactory: (...args: any[]) => Promise<CacheOptionsInterface> | CacheOptionsInterface;
    }): DynamicModule {
        return {
            module: CacheModule,
            imports: options.imports || [],
            providers: [
                {
                    provide: CACHE_OPTIONS_TOKEN,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                CacheService,
            ],
            exports: [CacheService],
            global: true,
        };
    }
}