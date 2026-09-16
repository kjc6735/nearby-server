import { Test, TestingModule } from '@nestjs/testing';
import { AuthPayload } from '../auth/common/auth.payload';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getMyProfile: jest.Mock;
    updateMyProfile: jest.Mock;
  };

  const currentUser: AuthPayload = { sub: 1, email: 'user@example.com' };

  beforeEach(async () => {
    usersService = {
      getMyProfile: jest.fn(),
      updateMyProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getMe', () => {
    it('토큰의 sub로 내 프로필을 조회한다', async () => {
      const profile = {
        id: 1,
        email: 'user@example.com',
        name: '테스터',
        username: 'tester',
      };
      usersService.getMyProfile.mockResolvedValue(profile);

      await expect(controller.getMe(currentUser)).resolves.toBe(profile);
      expect(usersService.getMyProfile).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('updateMyProfile', () => {
    it('토큰의 sub 기준으로 요청 바디를 넘겨 수정한다', async () => {
      const profile = {
        id: 1,
        email: 'user@example.com',
        name: '새이름',
        username: 'newname',
      };
      usersService.updateMyProfile.mockResolvedValue(profile);

      await expect(
        controller.updateMyProfile(currentUser, {
          name: '새이름',
          username: 'newname',
        }),
      ).resolves.toBe(profile);
      expect(usersService.updateMyProfile).toHaveBeenCalledWith({
        unique: { id: 1 },
        userUpdateInput: { name: '새이름', username: 'newname' },
      });
    });
  });
});
