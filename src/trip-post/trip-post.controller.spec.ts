import { Test, TestingModule } from '@nestjs/testing';
import { AuthPayload } from '../auth/common/auth.payload';
import { CreateTripPostRequestDto } from './dto/create-trip-post.request.dto';
import { GetTripPostsRequestDto } from './dto/get-trip-posts.request.dto';
import { UpdateTripPostRequestDto } from './dto/update-trip-post.request.dto';
import { TripPostController } from './trip-post.controller';
import { TripPostService } from './trip-post.service';

const MEET_AT = new Date('2026-10-01T09:00:00Z');

const requestDto: CreateTripPostRequestDto = {
  title: '북한산 같이 가요',
  content: '초보 환영',
  placeName: '북한산',
  capacity: 4,
  meetAt: MEET_AT,
  lat: 37.5,
  lng: 127.0,
  categorySlugs: ['hiking'],
};

describe('TripPostController', () => {
  let controller: TripPostController;
  let tripPostService: {
    getTripPost: jest.Mock;
    getTripPosts: jest.Mock;
    createTripPost: jest.Mock;
    updateTripPost: jest.Mock;
    deletePost: jest.Mock;
  };

  const currentUser: AuthPayload = { sub: 1, email: 'author@example.com' };

  beforeEach(async () => {
    tripPostService = {
      getTripPost: jest.fn(),
      getTripPosts: jest.fn(),
      createTripPost: jest.fn(),
      updateTripPost: jest.fn(),
      deletePost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripPostController],
      providers: [{ provide: TripPostService, useValue: tripPostService }],
    }).compile();

    controller = module.get<TripPostController>(TripPostController);
  });

  describe('getTripPosts', () => {
    it('쿼리 파라미터를 그대로 넘긴다', async () => {
      const query: GetTripPostsRequestDto = {
        lat: 37.5,
        lng: 127.0,
        range: 5,
        limit: 20,
      };
      const page = { items: [], nextCursor: null };
      tripPostService.getTripPosts.mockResolvedValue(page);

      await expect(controller.getTripPosts(query)).resolves.toBe(page);
      expect(tripPostService.getTripPosts).toHaveBeenCalledWith({
        getTripPostsRequestDto: query,
      });
    });
  });

  describe('getTripPost', () => {
    it('id로 단건을 조회한다', async () => {
      const tripPost = { id: 100 };
      tripPostService.getTripPost.mockResolvedValue(tripPost);

      await expect(controller.getTripPost(100)).resolves.toBe(tripPost);
      expect(tripPostService.getTripPost).toHaveBeenCalledWith({ id: 100 });
    });
  });

  describe('create', () => {
    it('토큰의 sub를 authorId로 넘긴다', async () => {
      const created = { id: 100 };
      tripPostService.createTripPost.mockResolvedValue(created);

      await expect(controller.create(currentUser, requestDto)).resolves.toBe(
        created,
      );
      expect(tripPostService.createTripPost).toHaveBeenCalledWith({
        authorId: 1,
        createTripPostRequestDto: requestDto,
      });
    });
  });

  describe('update', () => {
    it('id, authorId, 요청 바디를 함께 넘긴다', async () => {
      const updateDto: UpdateTripPostRequestDto = {
        ...requestDto,
        title: '수정된 제목',
      };
      const updated = { id: 100 };
      tripPostService.updateTripPost.mockResolvedValue(updated);

      await expect(
        controller.update(currentUser, 100, updateDto),
      ).resolves.toBe(updated);
      expect(tripPostService.updateTripPost).toHaveBeenCalledWith({
        id: 100,
        authorId: 1,
        updateTripPostRequestDto: updateDto,
      });
    });
  });

  describe('delete', () => {
    it('본문 없이 삭제를 위임한다', async () => {
      tripPostService.deletePost.mockResolvedValue(undefined);

      await expect(
        controller.delete(currentUser, 100),
      ).resolves.toBeUndefined();
      expect(tripPostService.deletePost).toHaveBeenCalledWith({
        id: 100,
        authorId: 1,
      });
    });
  });
});
