import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { CacheModule } from '../cache/cache.module'; // CacheModule 추가

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'recipe-ai-ultra-secure-key-2024!@#$',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d'
        },
      }),
      inject: [ConfigService],
    }),
    UserModule, // User 모듈 import
    CacheModule, // Cache 모듈 import (Redis 세션 관리용)
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
