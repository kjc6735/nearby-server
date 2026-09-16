import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import type { JwtConfig } from '../dto/jwt.config';
import { AuthGuard } from './auth.guard';

const JWT_CONFIG: JwtConfig = {
  accessTokenSecret: 'access-secret',
  refreshTokenSecret: 'refresh-secret',
  accessRoate: '15m',
  refreshRotate: '14d',
};

const PAYLOAD = { sub: 1, email: 'user@example.com' };

const createContext = (authorization?: string) => {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as Request;

  const handler = () => undefined;
  class TestController {}

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  return { context, request, handler, TestController };
};

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
        { provide: 'JWT_CONFIG', useValue: JWT_CONFIG },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  describe('@Public()', () => {
    it('공개 라우트는 토큰 없이 통과한다', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const { context } = createContext();

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('핸들러와 클래스 양쪽에서 isPublic 메타데이터를 찾는다', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const { context, handler, TestController } = createContext();

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        handler,
        TestController,
      ]);
    });
  });

  describe('Authorization 헤더', () => {
    it('헤더가 없으면 UnauthorizedException을 던진다', async () => {
      const { context } = createContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('Bearer 스킴이 아니면 UnauthorizedException을 던진다', async () => {
      const { context } = createContext('Basic dXNlcjpwdw==');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('토큰 없이 Bearer만 있으면 UnauthorizedException을 던진다', async () => {
      const { context } = createContext('Bearer');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  describe('토큰 검증', () => {
    it('accessTokenSecret으로 검증한다', async () => {
      jwtService.verifyAsync.mockResolvedValue(PAYLOAD);
      const { context } = createContext('Bearer access-token');

      await guard.canActivate(context);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
        secret: JWT_CONFIG.accessTokenSecret,
      });
    });

    it('refreshToken으로는 API를 호출할 수 없다', async () => {
      jwtService.verifyAsync.mockImplementation(
        (_token: string, options: { secret: string }) => {
          if (options.secret !== JWT_CONFIG.accessTokenSecret) {
            return Promise.resolve(PAYLOAD);
          }
          return Promise.reject(new Error('invalid signature'));
        },
      );
      const { context } = createContext('Bearer refresh-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('만료된 토큰이면 만료 메시지를 던진다', async () => {
      jwtService.verifyAsync.mockRejectedValue(
        new TokenExpiredError('jwt expired', new Date()),
      );
      const { context } = createContext('Bearer expired-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        '토큰이 만료되었습니다.',
      );
    });

    it('서명이 깨진 토큰이면 유효하지 않다는 메시지를 던진다', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
      const { context } = createContext('Bearer broken-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        '토큰이 유효하지 않습니다.',
      );
    });
  });

  describe('payload 검증', () => {
    it('sub가 number가 아니면 거부한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({ ...PAYLOAD, sub: '1' });
      const { context, request } = createContext('Bearer access-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        '토큰이 유효하지 않습니다.',
      );
      expect(request.user).toBeUndefined();
    });

    it('sub가 없으면 거부한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        email: 'user@example.com',
      });
      const { context } = createContext('Bearer access-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('email이 없으면 거부한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      const { context } = createContext('Bearer access-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  it('검증에 성공하면 request.user에 payload를 싣고 통과시킨다', async () => {
    jwtService.verifyAsync.mockResolvedValue(PAYLOAD);
    const { context, request } = createContext('Bearer access-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(PAYLOAD);
  });
});
