import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseOptionsInterface } from './interfaces/database-options.interface';

@Module({})
export class DatabaseModule {
    static forRoot(options?: DatabaseOptionsInterface): DynamicModule {
        return {
            module: DatabaseModule,
            imports: [
                MongooseModule.forRootAsync({
                    imports: [ConfigModule],
                    useFactory: async (configService: ConfigService) => ({
                        uri: options?.uri || configService.get<string>('MONGODB_URI'),
                        retryWrites: options?.retryWrites ?? false,
                        retryReads: options?.retryReads ?? false,
                        connectTimeoutMS: options?.connectTimeoutMS ?? 5000,
                        socketTimeoutMS: options?.socketTimeoutMS ?? 5000,
                        ...options?.mongooseOptions,
                    }),
                    inject: [ConfigService],
                }),
            ],
            exports: [MongooseModule],
            global: true,
        };
    }
}