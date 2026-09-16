import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const createResponse = () => {
  const setHeader = jest.fn();
  return { res: { setHeader } as unknown as Response, setHeader };
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    signUp: jest.Mock;
    refresh: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      signUp: jest.fn(),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('signIn', () => {
    const signInDto = { email: 'user@example.com', password: 'plain-password' };

    it('토큰을 반환하고 Authorization 헤더에 accessToken을 담는다', async () => {
      authService.signIn.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      const { res, setHeader } = createResponse();

      const result = await controller.signIn(signInDto, res);

      expect(authService.signIn).toHaveBeenCalledWith(signInDto);
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(setHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer access-token',
      );
    });

    it('서비스가 던진 에러를 그대로 전파한다', async () => {
      authService.signIn.mockRejectedValue(new Error('unauthorized'));
      const { res, setHeader } = createResponse();

      await expect(controller.signIn(signInDto, res)).rejects.toThrow(
        'unauthorized',
      );
      expect(setHeader).not.toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('요청 바디를 그대로 넘기고 본문 없이 응답한다', async () => {
      const signUpDto = {
        email: 'new@example.com',
        password: 'plain-password',
        username: 'newbie',
        name: '신규',
      };
      authService.signUp.mockResolvedValue(undefined);

      await expect(controller.signUp(signUpDto)).resolves.toBeUndefined();
      expect(authService.signUp).toHaveBeenCalledWith(signUpDto);
    });
  });

  describe('refresh', () => {
    it('refreshToken만 넘기고 새 accessToken을 헤더와 본문에 담는다', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });
      const { res, setHeader } = createResponse();

      const result = await controller.refresh(
        { refreshToken: 'refresh-token' },
        res,
      );

      expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(setHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer new-access-token',
      );
    });

    it('갱신에 실패하면 헤더를 설정하지 않는다', async () => {
      authService.refresh.mockRejectedValue(new Error('invalid token'));
      const { res, setHeader } = createResponse();

      await expect(
        controller.refresh({ refreshToken: 'broken' }, res),
      ).rejects.toThrow('invalid token');
      expect(setHeader).not.toHaveBeenCalled();
    });
  });
});
