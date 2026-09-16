import { Test, TestingModule } from '@nestjs/testing';
import { AuthPayload } from '../auth/common/auth.payload';
import { ParticipationStatus } from '../generated/prisma/enums';
import { ParticipationsController } from './participations.controller';
import { ParticipationsService } from './participations.service';

describe('ParticipationsController', () => {
  let controller: ParticipationsController;
  let participationsService: {
    getParticipationsByAuthor: jest.Mock;
    applyForTripPost: jest.Mock;
    cancelMyApplication: jest.Mock;
    changeApplicationStatusByAuthor: jest.Mock;
  };

  const currentUser: AuthPayload = { sub: 1, email: 'user@example.com' };

  beforeEach(async () => {
    participationsService = {
      getParticipationsByAuthor: jest.fn(),
      applyForTripPost: jest.fn(),
      cancelMyApplication: jest.fn(),
      changeApplicationStatusByAuthor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipationsController],
      providers: [
        {
          provide: ParticipationsService,
          useValue: participationsService,
        },
      ],
    }).compile();

    controller = module.get<ParticipationsController>(ParticipationsController);
  });

  describe('getParticipations', () => {
    it('요청자를 requestUserId로 넘겨 지원자 목록을 조회한다', async () => {
      const participations = [{ participationId: 500 }];
      participationsService.getParticipationsByAuthor.mockResolvedValue(
        participations,
      );

      await expect(
        controller.getParticipations(currentUser, 100),
      ).resolves.toBe(participations);
      expect(
        participationsService.getParticipationsByAuthor,
      ).toHaveBeenCalledWith({ tripPostId: 100, requestUserId: 1 });
    });
  });

  describe('applyForTripPost', () => {
    it('토큰의 sub를 userId로 넘긴다', async () => {
      participationsService.applyForTripPost.mockResolvedValue(undefined);

      await expect(
        controller.applyForTripPost(currentUser, 100),
      ).resolves.toBeUndefined();
      expect(participationsService.applyForTripPost).toHaveBeenCalledWith({
        userId: 1,
        tripPostId: 100,
      });
    });
  });

  describe('cancelMyApplication', () => {
    it('경로 파라미터 두 개와 userId를 함께 넘긴다', async () => {
      participationsService.cancelMyApplication.mockResolvedValue(undefined);

      await expect(
        controller.cancelMyApplication(currentUser, 100, 500),
      ).resolves.toBeUndefined();
      expect(participationsService.cancelMyApplication).toHaveBeenCalledWith({
        userId: 1,
        tripPostId: 100,
        participationId: 500,
      });
    });
  });

  describe('changeApplicationStatusByAuthor', () => {
    it('요청 바디의 status와 authorId를 넘긴다', async () => {
      participationsService.changeApplicationStatusByAuthor.mockResolvedValue(
        undefined,
      );

      await expect(
        controller.changeApplicationStatusByAuthor(currentUser, 100, 500, {
          status: ParticipationStatus.APPROVED,
        }),
      ).resolves.toBeUndefined();
      expect(
        participationsService.changeApplicationStatusByAuthor,
      ).toHaveBeenCalledWith({
        authorId: 1,
        tripPostId: 100,
        participationId: 500,
        status: ParticipationStatus.APPROVED,
      });
    });
  });
});
