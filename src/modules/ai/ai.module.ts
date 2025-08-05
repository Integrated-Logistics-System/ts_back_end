// src/modules/ai/ai.module.ts
import { Module, DynamicModule, Type } from '@nestjs/common';
import { AiService } from './ai.service';

export interface AiModuleOptions {
    config: {
        url?: string;
        model?: string;
        timeout?: number;
    };
}

@Module({})
export class AiModule {
    static forRoot(options: AiModuleOptions): DynamicModule {
        return {
            module: AiModule,
            providers: [
                {
                    provide: 'AI_OPTIONS',
                    useValue: options,
                },
                AiService,
            ],
            exports: [AiService],
            global: true,
        };
    }

    static forRootAsync(options: {
        useFactory: (...args: unknown[]) => Promise<AiModuleOptions> | AiModuleOptions;
        inject?: (string | symbol | Type<unknown>)[];
    }): DynamicModule {
        return {
            module: AiModule,
            providers: [
                {
                    provide: 'AI_OPTIONS',
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                AiService,
            ],
            exports: [AiService],
            global: true,
        };
    }
}