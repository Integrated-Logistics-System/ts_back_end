import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err || !user) {
      // JWT 토큰 관련 에러 정보를 자세히 제공
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('토큰이 만료되었습니다. 리프레시 토큰을 사용하여 새 토큰을 발급받으세요.');
      } else if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      } else if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('토큰이 아직 활성화되지 않았습니다.');
      }
      
      throw err || new UnauthorizedException('인증이 필요합니다.');
    }
    return user as TUser;
  }
}
