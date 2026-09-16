import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Participation,
  Prisma,
  TripPost,
  User,
} from '../generated/prisma/client';
import { ParticipationStatus, TripPostStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TripPostService } from '../trip-post/trip-post.service';
import { UsersService } from '../users/users.service';
import { ParticipationsService } from './participations.service';

const AUTHOR_ID = 1;
const APPLICANT_ID = 2;
const TRIP_POST_ID = 100;
const PARTICIPATION_ID = 500;
const JOINED_AT = new Date('2026-02-01T00:00:00Z');

const createUser = (overrides: Partial<User> = {}): User => ({
  id: APPLICANT_ID,
  email: 'applicant@example.com',
  username: 'applicant',
  name: '지원자',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createTripPost = (overrides: Partial<TripPost> = {}): TripPost => ({
  id: TRIP_POST_ID,
  title: '북한산 같이 가요',
  content: '초보 환영',
  placeName: '북한산',
  capacity: 4,
  status: TripPostStatus.OPEN,
  authorId: AUTHOR_ID,
  meetAt: new Date('2026-10-01T09:00:00Z'),
  lat: 37.5,
  lng: 127.0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

const createParticipation = (
  overrides: Partial<Participation> = {},
): Participation => ({
  id: PARTICIPATION_ID,
  tripPostId: TRIP_POST_ID,
  userId: APPLICANT_ID,
  status: ParticipationStatus.PENDING,
  createdAt: JOINED_AT,
  updatedAt: JOINED_AT,
  ...overrides,
});

describe('ParticipationsService', () => {
  let service: ParticipationsService;
  let prisma: {
    participation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let usersService: { findOne: jest.Mock };
  let tripPostService: { findOne: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    prisma = {
      participation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    usersService = { findOne: jest.fn() };
    tripPostService = { findOne: jest.fn(), update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: TripPostService, useValue: tripPostService },
      ],
    }).compile();

    service = module.get<ParticipationsService>(ParticipationsService);
  });

  describe('getParticipationsByAuthor', () => {
    it('작성자에게 지원자 목록을 DTO로 반환한다', async () => {
      tripPostService.findOne.mockResolvedValue({
        ...createTripPost(),
        author: createUser({ id: AUTHOR_ID }),
        participations: [{ ...createParticipation(), user: createUser() }],
      });

      const result = await service.getParticipationsByAuthor({
        tripPostId: TRIP_POST_ID,
        requestUserId: AUTHOR_ID,
      });

      expect(result).toEqual([
        {
          participationId: PARTICIPATION_ID,
          userId: APPLICANT_ID,
          username: 'applicant',
          email: 'applicant@example.com',
          joinedAt: JOINED_AT,
          status: ParticipationStatus.PENDING,
        },
      ]);
    });

    it('없는 게시물이면 NotFoundException을 던진다', async () => {
      tripPostService.findOne.mockResolvedValue(null);

      await expect(
        service.getParticipationsByAuthor({
          tripPostId: TRIP_POST_ID,
          requestUserId: AUTHOR_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('작성자가 아니면 ForbiddenException을 던진다', async () => {
      tripPostService.findOne.mockResolvedValue({
        ...createTripPost(),
        author: createUser({ id: AUTHOR_ID }),
        participations: [],
      });

      await expect(
        service.getParticipationsByAuthor({
          tripPostId: TRIP_POST_ID,
          requestUserId: APPLICANT_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('applyForTripPost', () => {
    const apply = () =>
      service.applyForTripPost({
        userId: APPLICANT_ID,
        tripPostId: TRIP_POST_ID,
      });

    it('모집 중인 남의 글에 지원하면 PENDING으로 생성된다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(null);
      prisma.participation.create.mockResolvedValue(createParticipation());

      await apply();

      expect(prisma.participation.create).toHaveBeenCalledWith({
        data: { userId: APPLICANT_ID, tripPostId: TRIP_POST_ID },
      });
    });

    it('없는 사용자면 NotFoundException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(null);
      tripPostService.findOne.mockResolvedValue(createTripPost());

      await expect(apply()).rejects.toThrow(NotFoundException);
      expect(prisma.participation.create).not.toHaveBeenCalled();
    });

    it('없는 게시물이면 NotFoundException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(null);

      await expect(apply()).rejects.toThrow(NotFoundException);
    });

    it('본인 게시물에는 지원할 수 없다', async () => {
      usersService.findOne.mockResolvedValue(createUser({ id: AUTHOR_ID }));
      tripPostService.findOne.mockResolvedValue(createTripPost());

      await expect(
        service.applyForTripPost({
          userId: AUTHOR_ID,
          tripPostId: TRIP_POST_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.participation.create).not.toHaveBeenCalled();
    });

    it.each([TripPostStatus.CLOSED, TripPostStatus.CANCELLED])(
      '%s 상태의 게시물에는 지원할 수 없다',
      async (status) => {
        usersService.findOne.mockResolvedValue(createUser());
        tripPostService.findOne.mockResolvedValue(createTripPost({ status }));

        await expect(apply()).rejects.toThrow(BadRequestException);
        expect(prisma.participation.create).not.toHaveBeenCalled();
      },
    );

    it('이미 지원한 게시물이면 ConflictException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(createParticipation());

      await expect(apply()).rejects.toThrow(ConflictException);
      expect(prisma.participation.create).not.toHaveBeenCalled();
    });

    it('거절당한 적이 있으면 다시 지원할 수 없다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(
        createParticipation({ status: ParticipationStatus.REJECTED }),
      );

      await expect(apply()).rejects.toThrow(ForbiddenException);
    });

    it('동시 지원으로 unique 위반(P2002)이 나면 ConflictException으로 바꾼다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(null);
      prisma.participation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(apply()).rejects.toThrow(ConflictException);
    });

    it('P2002가 아닌 에러는 그대로 전파한다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(null);
      prisma.participation.create.mockRejectedValue(new Error('db down'));

      await expect(apply()).rejects.toThrow('db down');
    });
  });

  describe('cancelMyApplication', () => {
    const cancel = () =>
      service.cancelMyApplication({
        userId: APPLICANT_ID,
        participationId: PARTICIPATION_ID,
        tripPostId: TRIP_POST_ID,
      });

    it('대기 중인 지원을 취소한다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(createParticipation());
      prisma.participation.delete.mockResolvedValue(createParticipation());

      await cancel();

      expect(prisma.participation.delete).toHaveBeenCalledWith({
        where: { id: PARTICIPATION_ID },
      });
      expect(tripPostService.update).not.toHaveBeenCalled();
    });

    it('승인된 지원을 취소하면 마감된 게시물이 다시 모집 중이 된다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      prisma.participation.findUnique.mockResolvedValue(
        createParticipation({ status: ParticipationStatus.APPROVED }),
      );
      prisma.participation.delete.mockResolvedValue(createParticipation());
      tripPostService.findOne.mockResolvedValue(
        createTripPost({ status: TripPostStatus.CLOSED }),
      );

      await cancel();

      expect(tripPostService.update).toHaveBeenCalledWith({
        where: { id: TRIP_POST_ID },
        status: TripPostStatus.OPEN,
      });
    });

    it('게시물이 아직 모집 중이면 상태를 건드리지 않는다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      prisma.participation.findUnique.mockResolvedValue(
        createParticipation({ status: ParticipationStatus.APPROVED }),
      );
      prisma.participation.delete.mockResolvedValue(createParticipation());
      tripPostService.findOne.mockResolvedValue(createTripPost());

      await cancel();

      expect(tripPostService.update).not.toHaveBeenCalled();
    });

    it('지원 이력이 없으면 NotFoundException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(null);

      await expect(cancel()).rejects.toThrow(NotFoundException);
      expect(prisma.participation.delete).not.toHaveBeenCalled();
    });

    it('삭제됐거나 없는 게시물이면 NotFoundException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(null);
      prisma.participation.findUnique.mockResolvedValue(createParticipation());

      await expect(cancel()).rejects.toThrow(NotFoundException);
      expect(prisma.participation.delete).not.toHaveBeenCalled();
    });

    it('없는 사용자면 NotFoundException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(null);
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(createParticipation());

      await expect(cancel()).rejects.toThrow(NotFoundException);
      expect(prisma.participation.delete).not.toHaveBeenCalled();
    });

    it('거절된 지원은 취소할 수 없다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(
        createParticipation({ status: ParticipationStatus.REJECTED }),
      );

      await expect(cancel()).rejects.toThrow(BadRequestException);
      expect(prisma.participation.delete).not.toHaveBeenCalled();
    });

    it('본인 지원만 취소할 수 있도록 userId와 tripPostId로 함께 조회한다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(createParticipation());
      prisma.participation.delete.mockResolvedValue(createParticipation());

      await cancel();

      expect(prisma.participation.findUnique).toHaveBeenCalledWith({
        where: {
          id: PARTICIPATION_ID,
          userId: APPLICANT_ID,
          tripPostId: TRIP_POST_ID,
        },
      });
    });

    it('삭제에 실패하면 InternalServerErrorException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(createTripPost());
      prisma.participation.findUnique.mockResolvedValue(createParticipation());
      prisma.participation.delete.mockRejectedValue(new Error('db down'));

      await expect(cancel()).rejects.toThrow(InternalServerErrorException);
    });

    it('삭제 후 모집 상태 되돌리기가 실패하면 InternalServerErrorException을 던진다', async () => {
      usersService.findOne.mockResolvedValue(createUser());
      tripPostService.findOne.mockResolvedValue(
        createTripPost({ status: TripPostStatus.CLOSED }),
      );
      prisma.participation.findUnique.mockResolvedValue(
        createParticipation({ status: ParticipationStatus.APPROVED }),
      );
      prisma.participation.delete.mockResolvedValue(createParticipation());
      tripPostService.update.mockRejectedValue(new Error('db down'));

      await expect(cancel()).rejects.toThrow(InternalServerErrorException);
      // 지원은 지워졌는데 게시물은 CLOSED로 남는다
      expect(prisma.participation.delete).toHaveBeenCalled();
    });
  });

  describe('changeApplicationStatusByAuthor', () => {
    const changeStatus = (
      status:
        | typeof ParticipationStatus.APPROVED
        | typeof ParticipationStatus.REJECTED,
      authorId = AUTHOR_ID,
    ) =>
      service.changeApplicationStatusByAuthor({
        authorId,
        participationId: PARTICIPATION_ID,
        tripPostId: TRIP_POST_ID,
        status,
      });

    const setup = ({
      post = createTripPost(),
      participation = createParticipation(),
      approvedCount = 0,
      author = createUser({ id: AUTHOR_ID }),
    }: {
      post?: TripPost;
      participation?: Participation | null;
      approvedCount?: number;
      author?: User | null;
    } = {}) => {
      usersService.findOne.mockResolvedValue(author);
      tripPostService.findOne.mockResolvedValue(post);
      prisma.participation.findMany.mockResolvedValue(
        Array.from({ length: approvedCount }, (_, i) =>
          createParticipation({
            id: 600 + i,
            status: ParticipationStatus.APPROVED,
          }),
        ),
      );
      prisma.participation.findUnique.mockResolvedValue(participation);
      prisma.participation.update.mockResolvedValue(createParticipation());
    };

    it('대기 중인 지원을 승인한다', async () => {
      setup();

      await changeStatus(ParticipationStatus.APPROVED);

      expect(prisma.participation.update).toHaveBeenCalledWith({
        where: { id: PARTICIPATION_ID },
        data: { status: ParticipationStatus.APPROVED },
      });
      expect(tripPostService.update).not.toHaveBeenCalled();
    });

    it('마지막 한 자리를 승인하면 게시물이 CLOSED가 된다', async () => {
      // 정원 3 = 작성자 1 + 기존 승인 1 + 이번 승인 1
      setup({ post: createTripPost({ capacity: 3 }), approvedCount: 1 });

      await changeStatus(ParticipationStatus.APPROVED);

      expect(tripPostService.update).toHaveBeenCalledWith({
        where: { id: TRIP_POST_ID },
        status: TripPostStatus.CLOSED,
      });
    });

    it('정원이 다 찼으면 승인할 수 없다', async () => {
      // 정원 3, 작성자 1 + 승인 2 = 3명
      setup({ post: createTripPost({ capacity: 3 }), approvedCount: 2 });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('모집이 마감된 게시물에는 승인할 수 없다', async () => {
      setup({ post: createTripPost({ status: TripPostStatus.CLOSED }) });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('대기 중이 아닌 지원은 승인할 수 없다', async () => {
      setup({
        participation: createParticipation({
          status: ParticipationStatus.APPROVED,
        }),
      });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('대기 중인 지원을 거절한다', async () => {
      setup();

      await changeStatus(ParticipationStatus.REJECTED);

      expect(prisma.participation.update).toHaveBeenCalledWith({
        where: { id: PARTICIPATION_ID },
        data: { status: ParticipationStatus.REJECTED },
      });
    });

    it('승인했던 지원을 거절하면 마감된 게시물이 다시 모집 중이 된다', async () => {
      setup({
        post: createTripPost({ status: TripPostStatus.CLOSED }),
        participation: createParticipation({
          status: ParticipationStatus.APPROVED,
        }),
        approvedCount: 1,
      });

      await changeStatus(ParticipationStatus.REJECTED);

      expect(tripPostService.update).toHaveBeenCalledWith({
        where: { id: TRIP_POST_ID },
        status: TripPostStatus.OPEN,
      });
    });

    it('취소된 여행은 상태를 바꿀 수 없다', async () => {
      setup({ post: createTripPost({ status: TripPostStatus.CANCELLED }) });

      await expect(changeStatus(ParticipationStatus.REJECTED)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('없는 지원요청이면 NotFoundException을 던진다', async () => {
      setup({ participation: null });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('다른 게시물의 지원요청이면 NotFoundException을 던진다', async () => {
      setup({ participation: createParticipation({ tripPostId: 999 }) });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('없는 게시물이면 NotFoundException을 던진다', async () => {
      setup();
      tripPostService.findOne.mockResolvedValue(null);

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('없는 사용자면 NotFoundException을 던진다', async () => {
      setup({ author: null });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('작성자가 아니면 ForbiddenException을 던진다', async () => {
      setup({ author: createUser({ id: APPLICANT_ID }) });

      await expect(
        changeStatus(ParticipationStatus.APPROVED, APPLICANT_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('상태 변경에 실패하면 InternalServerErrorException을 던진다', async () => {
      setup();
      prisma.participation.update.mockRejectedValue(new Error('db down'));

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('APPROVED와 REJECTED가 아닌 상태로는 바꿀 수 없다', async () => {
      setup();

      await expect(
        service.changeApplicationStatusByAuthor({
          authorId: AUTHOR_ID,
          participationId: PARTICIPATION_ID,
          tripPostId: TRIP_POST_ID,
          status:
            ParticipationStatus.PENDING as unknown as typeof ParticipationStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('거절된 지원은 다시 승인할 수 없다', async () => {
      setup({
        participation: createParticipation({
          status: ParticipationStatus.REJECTED,
        }),
      });

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('상태 변경 후 마감 처리가 실패하면 InternalServerErrorException을 던진다', async () => {
      setup({ post: createTripPost({ capacity: 3 }), approvedCount: 1 });
      tripPostService.update.mockRejectedValue(new Error('db down'));

      await expect(changeStatus(ParticipationStatus.APPROVED)).rejects.toThrow(
        InternalServerErrorException,
      );
      // 지원 상태는 이미 바뀐 뒤라 게시물만 OPEN으로 남는다
      expect(prisma.participation.update).toHaveBeenCalled();
    });

    it('승인 목록은 APPROVED 상태만 센다', async () => {
      setup();

      await changeStatus(ParticipationStatus.APPROVED);

      expect(prisma.participation.findMany).toHaveBeenCalledWith({
        where: {
          tripPostId: TRIP_POST_ID,
          status: ParticipationStatus.APPROVED,
        },
      });
    });
  });

  describe('getParticipations', () => {
    it('status를 생략하면 APPROVED만 조회한다', async () => {
      prisma.participation.findMany.mockResolvedValue([]);

      await service.getParticipations({ tripPostId: TRIP_POST_ID });

      expect(prisma.participation.findMany).toHaveBeenCalledWith({
        where: {
          tripPostId: TRIP_POST_ID,
          status: ParticipationStatus.APPROVED,
        },
      });
    });

    it('status를 주면 그 상태로 조회한다', async () => {
      prisma.participation.findMany.mockResolvedValue([]);

      await service.getParticipations({
        tripPostId: TRIP_POST_ID,
        status: ParticipationStatus.PENDING,
      });

      expect(prisma.participation.findMany).toHaveBeenCalledWith({
        where: {
          tripPostId: TRIP_POST_ID,
          status: ParticipationStatus.PENDING,
        },
      });
    });
  });
});
