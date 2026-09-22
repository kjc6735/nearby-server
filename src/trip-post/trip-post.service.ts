import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { Prisma } from '../generated/prisma/client';
import { ParticipationStatus, TripPostStatus } from '../generated/prisma/enums';
import {
  TripPostInclude,
  TripPostWhereUniqueInput,
} from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripPostRequestDto } from './dto/create-trip-post.request.dto';
import { GetTripPostsRequestDto } from './dto/get-trip-posts.request.dto';
import { TripPostDto } from './dto/trip-post.dto';
import {
  CreateTripPostInput,
  UpdateTripPostInput,
} from './dto/trip-post.input.dto';
import { UpdateTripPostRequestDto } from './dto/update-trip-post.request.dto';

export const EARTH_RADIUS_KM = 6371;

function parseCursor(cursor?: string) {
  if (!cursor) return undefined;

  const [distanceKm, id] = cursor.split(':');
  return { distanceKm: Number(distanceKm), id: Number(id) };
}

export const TRIP_POST_INCLUDE = {
  author: true,
  categories: {
    include: { category: true },
    orderBy: { category: { displayOrder: 'asc' } },
  },
} satisfies TripPostInclude;

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
    const { limit, cursor, lat, lng, range } = getTripPostsRequestDto;

    const nearby = await this.findNearbyIds({
      lat,
      lng,
      range,
      take: limit + 1,
      cursor: parseCursor(cursor),
    });

    const hasNext = nearby.length > limit;
    const page = hasNext ? nearby.slice(0, limit) : nearby;

    const tripPosts = await this.findManyByIds(page.map(({ id }) => id));
    const last = page.at(-1);

    return {
      items: TripPostDto.fromMany(tripPosts),
      nextCursor: hasNext && last ? `${last.distanceKm}:${last.id}` : null,
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

    const { status: currentStatus } = await this.assertAuthor({
      where,
      authorId,
    });

    if (currentStatus === TripPostStatus.CANCELLED) {
      throw new BadRequestException('취소된 여행은 수정할 수 없습니다.');
    }

    // 정원은 작성자 포함
    const approvedCount = await this.prismaService.participation.count({
      where: { tripPostId: id, status: ParticipationStatus.APPROVED },
    });
    const memberCount = approvedCount + 1;

    if (tripPostInput.capacity < memberCount) {
      throw new BadRequestException(
        `현재 참여 인원(${memberCount}명)보다 적게 정원을 설정할 수 없습니다.`,
      );
    }

    // 정원이 바뀌면 모집 상태도 다시 계산
    const status =
      tripPostInput.capacity === memberCount
        ? TripPostStatus.CLOSED
        : TripPostStatus.OPEN;

    const categories = await this.resolveCategories(categorySlugs);

    const tripPost = await this.update({
      where,
      ...tripPostInput,
      status,
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
  async findOne<T extends TripPostInclude = typeof TRIP_POST_INCLUDE>({
    where,
    include,
  }: {
    where: TripPostWhereUniqueInput;
    include?: T;
  }) {
    return this.prismaService.tripPost.findFirst({
      where: { ...where, deletedAt: null },
      include: (include ?? TRIP_POST_INCLUDE) as T,
    });
  }

  async findNearbyIds({
    lat,
    lng,
    range,
    take,
    cursor,
  }: {
    lat: number;
    lng: number;
    range: number;
    take: number;
    cursor?: { distanceKm: number; id: number };
  }) {
    const distance = Prisma.sql`(
      ${EARTH_RADIUS_KM} * acos(LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians("lat")) *
        cos(radians("lng") - radians(${lng})) +
        sin(radians(${lat})) * sin(radians("lat"))
      )))
    )`;

    const afterCursor = cursor
      ? Prisma.sql`AND (${distance}, "id") > (${cursor.distanceKm}, ${cursor.id})`
      : Prisma.empty;

    return this.prismaService.$queryRaw<{ id: number; distanceKm: number }[]>(
      Prisma.sql`
        SELECT "id", ${distance} AS "distanceKm"
        FROM "TripPost"
        WHERE "deletedAt" IS NULL
          AND ${distance} <= ${range}
          ${afterCursor}
        ORDER BY "distanceKm" ASC, "id" ASC
        LIMIT ${take}
      `,
    );
  }

  async findManyByIds(ids: number[]) {
    if (ids.length === 0) return [];

    const tripPosts = await this.prismaService.tripPost.findMany({
      where: { id: { in: ids } },
      include: TRIP_POST_INCLUDE,
    });

    const byId = new Map(tripPosts.map((tripPost) => [tripPost.id, tripPost]));
    return ids
      .map((id) => byId.get(id))
      .filter((tripPost) => tripPost !== undefined);
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
        ...(categoryIds && {
          categories: {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
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
      select: { authorId: true, status: true },
    });

    if (!tripPost) {
      throw new NotFoundException('존재하지 않는 동행 글입니다.');
    }

    if (tripPost.authorId !== authorId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }

    return tripPost;
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
