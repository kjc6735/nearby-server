import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { JwtConfig } from './dto/jwt.config';

jest.mock('bcrypt');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

const JWT_CONFIG: JwtConfig = {
  accessTokenSecret: 'access-secret',
  refreshTokenSecret: 'refresh-secret',
  accessRoate: '15m',
  refreshRotate: '14d',
};
const SALT_OR_ROUND = 12;

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'user@example.com',
  username: 'tester',
  name: '테스터',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findOne: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = { findOne: jest.fn(), create: jest.fn() };
    jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: 'JWT_CONFIG', useValue: JWT_CONFIG },
        { provide: 'SALT_OR_ROUND', useValue: SALT_OR_ROUND },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signIn', () => {
    it('비밀번호가 맞으면 accessToken과 refreshToken을 발급한다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.signIn({
        email: 'user@example.com',
        password: 'plain-password',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(usersService.findOne).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'plain-password',
        'hashed-password',
      );
    });

    it('accessToken과 refreshToken을 각각 다른 시크릿과 만료시간으로 서명한다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue('token');

      await service.signIn({
        email: 'user@example.com',
        password: 'plain-password',
      });

      const payload = { sub: 1, email: 'user@example.com' };
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, payload, {
        secret: JWT_CONFIG.accessTokenSecret,
        expiresIn: JWT_CONFIG.accessRoate,
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, payload, {
        secret: JWT_CONFIG.refreshTokenSecret,
        expiresIn: JWT_CONFIG.refreshRotate,
      });
    });

    it('없는 이메일이면 UnauthorizedException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 'nobody@example.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcryptMock.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('비밀번호가 틀리면 UnauthorizedException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.signIn({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('비밀번호가 없는 계정이면 bcrypt를 호출하지 않고 UnauthorizedException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser({ password: null }));

      await expect(
        service.signIn({ email: 'user@example.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcryptMock.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('없는 이메일과 틀린 비밀번호의 메시지가 같아야 계정 존재 여부가 드러나지 않는다', async () => {
      usersService.findOne.mockResolvedValue(null);
      const notFound = await service
        .signIn({ email: 'nobody@example.com', password: 'pw' })
        .catch((e: Error) => e.message);

      usersService.findOne.mockResolvedValue(createUser());
      bcryptMock.compare.mockResolvedValue(false as never);
      const wrongPassword = await service
        .signIn({ email: 'user@example.com', password: 'wrong' })
        .catch((e: Error) => e.message);

      usersService.findOne.mockResolvedValue(createUser({ password: null }));
      const noPassword = await service
        .signIn({ email: 'user@example.com', password: 'pw' })
        .catch((e: Error) => e.message);

      expect(notFound).toBe(wrongPassword);
      expect(noPassword).toBe(wrongPassword);
    });
  });

  describe('refresh', () => {
    it('refreshToken이 유효하면 accessToken을 새로 발급한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        email: 'user@example.com',
      });
      jwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        { secret: JWT_CONFIG.refreshTokenSecret },
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, email: 'user@example.com' },
        {
          secret: JWT_CONFIG.accessTokenSecret,
          expiresIn: JWT_CONFIG.accessRoate,
        },
      );
    });

    it('검증에 실패하면 UnauthorizedException을 던진다', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.refresh('broken-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('accessToken으로는 갱신할 수 없다(refresh 시크릿으로만 검증한다)', async () => {
      jwtService.verifyAsync.mockImplementation(
        (_token: string, options: { secret: string }) => {
          if (options.secret !== JWT_CONFIG.refreshTokenSecret) {
            return Promise.resolve({ sub: 1, email: 'user@example.com' });
          }
          return Promise.reject(new Error('invalid signature'));
        },
      );

      await expect(service.refresh('access-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('signUp', () => {
    const signUpData = {
      email: 'new@example.com',
      password: 'plain-password',
      username: 'newbie',
      name: '신규',
    };

    it('비밀번호를 해시해서 사용자를 생성한다', async () => {
      usersService.findOne.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);

      await service.signUp(signUpData);

      expect(usersService.create).toHaveBeenCalledWith({
        ...signUpData,
        password: 'hashed-password',
      });

      expect(usersService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ password: signUpData.password }),
      );
    });

    it('설정된 SALT_OR_ROUND로 해시한다', async () => {
      usersService.findOne.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);

      await service.signUp(signUpData);

      expect(bcryptMock.hash).toHaveBeenCalledWith(
        signUpData.password,
        SALT_OR_ROUND,
      );
    });

    it('이미 가입된 이메일이면 ConflictException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());

      await expect(service.signUp(signUpData)).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('동시 가입으로 unique 위반(P2002)이 나면 ConflictException으로 바꾼다', async () => {
      usersService.findOne.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.signUp(signUpData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('그 밖의 에러는 그대로 전파한다', async () => {
      usersService.findOne.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockRejectedValue(new Error('db down'));

      await expect(service.signUp(signUpData)).rejects.toThrow('db down');
    });
  });
});
