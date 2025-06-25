// backend/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'recipe-ai-ultra-secure-key-2024!@#$',
    });

    console.log('🔑 JWT Strategy initialized with secret:',
      configService.get<string>('JWT_SECRET') ? 'FROM_ENV' : 'DEFAULT'
    );
  }

  async validate(payload: any) {
    console.log('🔍 JWT Strategy - Validating payload:', {
      sub: payload.sub,
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp
    });

    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      console.log('❌ JWT Strategy - User not found for ID:', payload.sub);
      throw new UnauthorizedException('User not found');
    }

    console.log('✅ JWT Strategy - User validated:', {
      id: user._id.toString(),
      email: user.email
    });

    return { id: payload.sub, email: payload.email };
  }
}