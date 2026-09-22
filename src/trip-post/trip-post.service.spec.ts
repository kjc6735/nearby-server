import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories/categories.service';
import { Category, TripPost, User } from '../generated/prisma/client';
import { TripPostStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripPostRequestDto } from './dto/create-trip-post.request.dto';
import { UpdateTripPostRequestDto } from './dto/update-trip-post.request.dto';
import { TripPostService } from './trip-post.service';

const MEET_AT = new Date('2026-10-01T09:00:00Z');

const createAuthor = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'author@example.com',
  username: 'author',
  name: '작성자',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 10,
  slug: 'hiking',
  name: '등산',
  displayOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

type TripPostRow = TripPost & {
  author: User;
  categories: { category: Category }[];
};

const createTripPostRow = (
  overrides: Partial<TripPostRow> = {},
): TripPostRow => ({
  id: 100,
  title: '북한산 같이 가요',
  content: '초보 환영',
  placeName: '북한산',
  capacity: 4,
  status: TripPostStatus.OPEN,
  authorId: 1,
  meetAt: MEET_AT,
  lat: 37.5,
  lng: 127.0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  author: createAuthor(),
  categories: [{ category: createCategory() }],
  ...overrides,
});

const createRequestDto = (
  overrides: Partial<CreateTripPostRequestDto> = {},
): CreateTripPostRequestDto => ({
  title: '북한산 같이 가요',
  content: '초보 환영',
  placeName: '북한산',
  capacity: 4,
  meetAt: MEET_AT,
  lat: 37.5,
  lng: 127.0,
  categorySlugs: ['hiking'],
  ...overrides,
});

const updateRequestDto = (
  overrides: Partial<UpdateTripPostRequestDto> = {},
): UpdateTripPostRequestDto => ({
  title: '수정된 제목',
  content: '수정된 본문',
  placeName: '도봉산',
  capacity: 4,
  meetAt: MEET_AT,
  lat: 37.5,
  lng: 127.0,
  categorySlugs: ['hiking'],
  ...overrides,
});

describe('TripPostService', () => {
  let service: TripPostService;
  let prisma: {
    tripPost: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    participation: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let categoriesService: { getCategories: jest.Mock };

  beforeEach(async () => {
    prisma = {
      tripPost: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      participation: { count: jest.fn() },
      $queryRaw: jest.fn(),
    };
    categoriesService = { getCategories: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripPostService,
        { provide: PrismaService, useValue: prisma },
        { provide: CategoriesService, useValue: categoriesService },
      ],
    }).compile();

    service = module.get<TripPostService>(TripPostService);
  });

  describe('getTripPost', () => {
    it('글을 DTO로 변환해 반환한다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(createTripPostRow());

      const result = await service.getTripPost({ id: 100 });

      expect(result).toEqual({
        id: 100,
        title: '북한산 같이 가요',
        content: '초보 환영',
        placeName: '북한산',
        capacity: 4,
        status: TripPostStatus.OPEN,
        author: { id: 1, name: '작성자', username: 'author' },
        meetAt: MEET_AT,
        lat: 37.5,
        lng: 127.0,
        categories: [{ slug: 'hiking', name: '등산', displayOrder: 1 }],
      });
    });

    it('작성자의 email과 password는 노출하지 않는다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(createTripPostRow());

      const result = await service.getTripPost({ id: 100 });

      // DTO 필드가 private이라 직렬화 결과로 확인한다
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('author@example.com');
      expect(serialized).not.toContain('hashed-password');
    });

    it('소프트 삭제된 글은 제외하고 조회한다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(createTripPostRow());

      await service.getTripPost({ id: 100 });

      expect(prisma.tripPost.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 100, deletedAt: null } }),
      );
    });

    it('없는 글이면 NotFoundException을 던진다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(null);

      await expect(service.getTripPost({ id: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTripPosts', () => {
    const query = { lat: 37.5, lng: 127.0, range: 5, limit: 2 };

    it('limit보다 한 개 더 조회해서 다음 페이지 여부를 판단한다', async () => {
      const findNearbyIds = jest.spyOn(service, 'findNearbyIds');
      prisma.$queryRaw.mockResolvedValue([
        { id: 3, distanceKm: 0.5 },
        { id: 2, distanceKm: 1.25 },
        { id: 1, distanceKm: 2 },
      ]);
      prisma.tripPost.findMany.mockResolvedValue([
        createTripPostRow({ id: 3 }),
        createTripPostRow({ id: 2 }),
      ]);

      const result = await service.getTripPosts({
        getTripPostsRequestDto: query,
      });

      expect(findNearbyIds).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(prisma.tripPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [3, 2] } } }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('1.25:2');
    });

    it('마지막 페이지면 nextCursor가 null이다', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 3, distanceKm: 0.5 }]);
      prisma.tripPost.findMany.mockResolvedValue([
        createTripPostRow({ id: 3 }),
      ]);

      const result = await service.getTripPosts({
        getTripPostsRequestDto: query,
      });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('결과가 없으면 연관 데이터를 조회하지 않고 빈 배열과 null 커서를 반환한다', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getTripPosts({
        getTripPostsRequestDto: query,
      });

      expect(result).toEqual({ items: [], nextCursor: null });
      expect(prisma.tripPost.findMany).not.toHaveBeenCalled();
    });

    it('cursor가 있으면 거리와 id로 풀어서 넘긴다', async () => {
      const findNearbyIds = jest.spyOn(service, 'findNearbyIds');
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getTripPosts({
        getTripPostsRequestDto: { ...query, cursor: '3.421:15832' },
      });

      expect(findNearbyIds).toHaveBeenCalledWith({
        lat: 37.5,
        lng: 127.0,
        range: 5,
        take: 3,
        cursor: { distanceKm: 3.421, id: 15832 },
      });
    });

    it('연관 데이터를 다시 읽어도 가까운 순서를 유지한다', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 5, distanceKm: 0.1 },
        { id: 1, distanceKm: 0.2 },
      ]);
      prisma.tripPost.findMany.mockResolvedValue([
        createTripPostRow({ id: 1 }),
        createTripPostRow({ id: 5 }),
      ]);

      const result = await service.getTripPosts({
        getTripPostsRequestDto: query,
      });

      expect(result.items).toEqual([
        expect.objectContaining({ id: 5 }),
        expect.objectContaining({ id: 1 }),
      ]);
    });
  });

  describe('createTripPost', () => {
    it('슬러그를 카테고리 id로 바꿔서 글을 만든다', async () => {
      categoriesService.getCategories.mockResolvedValue([createCategory()]);
      prisma.tripPost.create.mockResolvedValue(createTripPostRow());

      const result = await service.createTripPost({
        authorId: 1,
        createTripPostRequestDto: createRequestDto(),
      });

      expect(categoriesService.getCategories).toHaveBeenCalledWith({
        categoryWhereInput: { slug: { in: ['hiking'] }, isActive: true },
      });
      expect(prisma.tripPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: '북한산 같이 가요',
            authorId: 1,
            capacity: 4,
            categories: { create: [{ categoryId: 10 }] },
          }) as unknown,
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 100 }));
    });

    it('content와 placeName을 안 보내면 null로 저장한다', async () => {
      categoriesService.getCategories.mockResolvedValue([createCategory()]);
      prisma.tripPost.create.mockResolvedValue(createTripPostRow());

      await service.createTripPost({
        authorId: 1,
        createTripPostRequestDto: createRequestDto({
          content: undefined,
          placeName: undefined,
        }),
      });

      expect(prisma.tripPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: null,
            placeName: null,
          }) as unknown,
        }),
      );
    });

    it('없거나 비활성인 슬러그가 있으면 BadRequestException을 던진다', async () => {
      categoriesService.getCategories.mockResolvedValue([createCategory()]);

      await expect(
        service.createTripPost({
          authorId: 1,
          createTripPostRequestDto: createRequestDto({
            categorySlugs: ['hiking', 'unknown'],
          }),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tripPost.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTripPost', () => {
    const authorRow = { authorId: 1, status: TripPostStatus.OPEN };

    it('정원에 여유가 있으면 OPEN 상태로 수정한다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(authorRow);
      prisma.participation.count.mockResolvedValue(1);
      categoriesService.getCategories.mockResolvedValue([createCategory()]);
      prisma.tripPost.update.mockResolvedValue(createTripPostRow());

      await service.updateTripPost({
        id: 100,
        authorId: 1,
        updateTripPostRequestDto: updateRequestDto({ capacity: 4 }),
      });

      expect(prisma.tripPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 100 },
          data: expect.objectContaining({
            title: '수정된 제목',
            capacity: 4,
            status: TripPostStatus.OPEN,
            categories: {
              deleteMany: {},
              create: [{ categoryId: 10 }],
            },
          }) as unknown,
        }),
      );
    });

    it('content와 placeName을 안 보내면 null로 지운다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(authorRow);
      prisma.participation.count.mockResolvedValue(1);
      categoriesService.getCategories.mockResolvedValue([createCategory()]);
      prisma.tripPost.update.mockResolvedValue(createTripPostRow());

      await service.updateTripPost({
        id: 100,
        authorId: 1,
        updateTripPostRequestDto: updateRequestDto({
          content: undefined,
          placeName: undefined,
        }),
      });

      expect(prisma.tripPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: null,
            placeName: null,
          }) as unknown,
        }),
      );
    });

    it('정원을 현재 인원과 같게 줄이면 CLOSED로 바꾼다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(authorRow);
      // 승인된 지원 1명 + 작성자 = 2명
      prisma.participation.count.mockResolvedValue(1);
      categoriesService.getCategories.mockResolvedValue([createCategory()]);
      prisma.tripPost.update.mockResolvedValue(createTripPostRow());

      await service.updateTripPost({
        id: 100,
        authorId: 1,
        updateTripPostRequestDto: updateRequestDto({ capacity: 2 }),
      });

      expect(prisma.tripPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TripPostStatus.CLOSED,
          }) as unknown,
        }),
      );
    });

    it('현재 인원보다 정원을 적게 설정하면 BadRequestException을 던진다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(authorRow);
      // 승인된 지원 2명 + 작성자 = 3명
      prisma.participation.count.mockResolvedValue(2);

      await expect(
        service.updateTripPost({
          id: 100,
          authorId: 1,
          updateTripPostRequestDto: updateRequestDto({ capacity: 2 }),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tripPost.update).not.toHaveBeenCalled();
    });

    it('취소된 여행은 수정할 수 없다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue({
        authorId: 1,
        status: TripPostStatus.CANCELLED,
      });

      await expect(
        service.updateTripPost({
          id: 100,
          authorId: 1,
          updateTripPostRequestDto: updateRequestDto(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tripPost.update).not.toHaveBeenCalled();
    });

    it('작성자가 아니면 ForbiddenException을 던진다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(authorRow);

      await expect(
        service.updateTripPost({
          id: 100,
          authorId: 999,
          updateTripPostRequestDto: updateRequestDto(),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tripPost.update).not.toHaveBeenCalled();
    });

    it('없는 글이면 NotFoundException을 던진다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTripPost({
          id: 999,
          authorId: 1,
          updateTripPostRequestDto: updateRequestDto(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('deletedAt을 채우는 소프트 삭제를 한다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue({
        authorId: 1,
        status: TripPostStatus.OPEN,
      });
      prisma.tripPost.update.mockResolvedValue(createTripPostRow());

      await service.deletePost({ id: 100, authorId: 1 });

      expect(prisma.tripPost.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { deletedAt: expect.any(Date) as unknown },
      });
    });

    it('작성자가 아니면 ForbiddenException을 던지고 삭제하지 않는다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue({
        authorId: 1,
        status: TripPostStatus.OPEN,
      });

      await expect(
        service.deletePost({ id: 100, authorId: 999 }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tripPost.update).not.toHaveBeenCalled();
    });

    it('없는 글이면 NotFoundException을 던진다', async () => {
      prisma.tripPost.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePost({ id: 999, authorId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
