import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { TripPostWhereUniqueInput } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripPostRequestDto } from './dto/create-trip-post.request.dto';
import { GetTripPostsRequestDto } from './dto/get-trip-posts.request.dto';
import { TripPostDto } from './dto/trip-post.dto';
import {
  CreateTripPostInput,
  UpdateTripPostInput,
} from './dto/trip-post.input.dto';
import { UpdateTripPostRequestDto } from './dto/update-trip-post.request.dto';

const TRIP_POST_INCLUDE = {
  author: true,
  categories: {
    include: { category: true },
    orderBy: { category: { displayOrder: 'asc' } },
  },
} as const;

@Injectable()
export class TripPostService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // query
  async getTripPost({ id }: { id: number }): Promise<TripPostDto> {
    const tripPost = await this.findOne({ where: { id } });

    if (!tripPost) {
      throw new NotFoundException('존재하지 않는 동행 글입니다.');
    }

    return TripPostDto.from(tripPost);
  }

  async getTripPosts({
    getTripPostsRequestDto,
  }: {
    getTripPostsRequestDto: GetTripPostsRequestDto;
  }) {
    const { limit, cursor } = getTripPostsRequestDto;

    const tripPosts = await this.findMany({ take: limit + 1, cursor });

    const hasNext = tripPosts.length > limit;
    const items = hasNext ? tripPosts.slice(0, limit) : tripPosts;

    return {
      items: TripPostDto.fromMany(items),
      nextCursor: hasNext ? items[items.length - 1].id : null,
    };
  }

  async createTripPost({
    authorId,
    createTripPostRequestDto,
  }: {
    authorId: number;
    createTripPostRequestDto: CreateTripPostRequestDto;
  }): Promise<TripPostDto> {
    const { categorySlugs, content, placeName, ...tripPostInput } =
      createTripPostRequestDto;

    const categories = await this.resolveCategories(categorySlugs);

    const tripPost = await this.create({
      ...tripPostInput,
      content: content ?? null,
      placeName: placeName ?? null,
      authorId,
      categoryIds: categories.map(({ id }) => id),
    });

    return TripPostDto.from(tripPost);
  }

  async updateTripPost({
    id,
    authorId,
    updateTripPostRequestDto,
  }: {
    id: number;
    authorId: number;
    updateTripPostRequestDto: UpdateTripPostRequestDto;
  }): Promise<TripPostDto> {
    const { categorySlugs, content, placeName, ...tripPostInput } =
      updateTripPostRequestDto;
    const where: TripPostWhereUniqueInput = { id };

    await this.assertAuthor({ where, authorId });

    const categories = await this.resolveCategories(categorySlugs);

    const tripPost = await this.update({
      where,
      ...tripPostInput,
      content: content ?? null,
      placeName: placeName ?? null,
      categoryIds: categories.map(({ id }) => id),
    });

    return TripPostDto.from(tripPost);
  }

  async deletePost({ id, authorId }: { id: number; authorId: number }) {
    const where: TripPostWhereUniqueInput = { id };

    await this.assertAuthor({ where, authorId });
    await this.delete({ where });
  }

  // core
  /**
   * 소프트 삭제된 글은 없는 것으로 취급해야 해서 findUnique 대신 findFirst를
   * 쓴다. findUnique는 where에 deletedAt 같은 비유니크 조건을 못 받는다.
   */
  async findOne({ where }: { where: TripPostWhereUniqueInput }) {
    return this.prismaService.tripPost.findFirst({
      where: { ...where, deletedAt: null },
      include: TRIP_POST_INCLUDE,
    });
  }

  async findMany({ take, cursor }: { take: number; cursor?: number }) {
    return this.prismaService.tripPost.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: TRIP_POST_INCLUDE,
    });
  }

  async create({ categoryIds, ...data }: CreateTripPostInput) {
    return this.prismaService.tripPost.create({
      data: {
        ...data,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: TRIP_POST_INCLUDE,
    });
  }

  async update({ where, categoryIds, ...data }: UpdateTripPostInput) {
    return this.prismaService.tripPost.update({
      where,
      data: {
        ...data,
        categories: {
          deleteMany: {},
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: TRIP_POST_INCLUDE,
    });
  }

  async delete({ where }: { where: TripPostWhereUniqueInput }) {
    await this.prismaService.tripPost.update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  private async assertAuthor({
    where,
    authorId,
  }: {
    where: TripPostWhereUniqueInput;
    authorId: number;
  }) {
    const tripPost = await this.prismaService.tripPost.findFirst({
      where: { ...where, deletedAt: null },
      select: { authorId: true },
    });

    if (!tripPost) {
      throw new NotFoundException('존재하지 않는 동행 글입니다.');
    }

    if (tripPost.authorId !== authorId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }
  }

  private async resolveCategories(categorySlugs: string[]) {
    const categories = await this.categoriesService.getCategories({
      categoryWhereInput: { slug: { in: categorySlugs }, isActive: true },
    });

    if (categories.length !== categorySlugs.length) {
      throw new BadRequestException(
        '사용할 수 없는 카테고리가 포함되어 있습니다.',
      );
    }

    return categories;
  }
}
