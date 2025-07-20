import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
      private readonly configService: ConfigService,
      private readonly authService: AuthService, // AuthService를 통해 간접 접근
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'recipe-ai-ultra-secure-key-2024!@#'
    });
  }

  async validate(payload: { sub: string; email?: string; iat?: number; exp?: number }) {
    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }
    return user;
  }
}