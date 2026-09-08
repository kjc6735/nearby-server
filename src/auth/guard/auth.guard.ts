import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthPayload } from '../common/auth.payload';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import type { JwtConfig } from '../dto/jwt.config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject('JWT_CONFIG') private readonly jwtConfig: JwtConfig,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: AuthPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthPayload>(token, {
        secret: this.jwtConfig.accessTokenSecret,
      });
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new UnauthorizedException('토큰이 만료되었습니다.');
      }
      throw new UnauthorizedException('토큰이 유효하지 않습니다.');
    }

    // verifyAsync의 제네릭은 타입 캐스트일 뿐이라 payload 내용은 직접 확인해야 한다.
    if (typeof payload.sub !== 'number' || !payload.email) {
      throw new UnauthorizedException('토큰이 유효하지 않습니다.');
    }

    request.user = payload;
    return true;
  }
}
