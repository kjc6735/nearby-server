import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateTripPostRequestDto } from './create-trip-post.request.dto';
import {
  DEFAULT_TRIP_POST_PAGE_SIZE,
  DEFAULT_TRIP_POST_RANGE_KM,
  GetTripPostsRequestDto,
} from './get-trip-posts.request.dto';
import { UpdateTripPostRequestDto } from './update-trip-post.request.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const metadataOf = (
  metatype: new () => object,
  type: ArgumentMetadata['type'],
): ArgumentMetadata => ({ type, metatype, data: undefined });

const messagesOf = async (
  metatype: new () => object,
  value: unknown,
  type: ArgumentMetadata['type'] = 'body',
): Promise<string[]> => {
  try {
    await pipe.transform(value, metadataOf(metatype, type));
    return [];
  } catch (e) {
    const response = (e as BadRequestException).getResponse();
    return (response as { message: string[] }).message;
  }
};

const createBody = {
  title: '북한산 같이 가요',
  content: '초보 환영',
  placeName: '북한산',
  capacity: 4,
  meetAt: '2026-10-01T09:00:00.000Z',
  lat: 37.5,
  lng: 127.0,
  categorySlugs: ['hiking'],
};

describe('CreateTripPostRequestDto', () => {
  it('올바른 값이면 통과한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, createBody),
    ).resolves.toEqual([]);
  });

  it('meetAt 문자열을 Date로 변환한다', async () => {
    const result = (await pipe.transform(
      createBody,
      metadataOf(CreateTripPostRequestDto, 'body'),
    )) as CreateTripPostRequestDto;

    expect(result).toBeInstanceOf(CreateTripPostRequestDto);
    expect(result.meetAt).toBeInstanceOf(Date);
    expect(result.meetAt.toISOString()).toBe('2026-10-01T09:00:00.000Z');
  });

  it('meetAt이 날짜가 아니면 거부한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        meetAt: 'not-a-date',
      }),
    ).resolves.not.toEqual([]);
  });

  it('content와 placeName은 생략할 수 있다', async () => {
    const body = {
      title: createBody.title,
      capacity: createBody.capacity,
      meetAt: createBody.meetAt,
      lat: createBody.lat,
      lng: createBody.lng,
      categorySlugs: createBody.categorySlugs,
    };

    await expect(messagesOf(CreateTripPostRequestDto, body)).resolves.toEqual(
      [],
    );
  });

  it('정원은 2명 이상이어야 한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, capacity: 1 }),
    ).resolves.not.toEqual([]);
  });

  it('정원은 정수여야 한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, capacity: 2.5 }),
    ).resolves.not.toEqual([]);
  });

  it('위경도 범위를 벗어나면 거부한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, lat: 100 }),
    ).resolves.not.toEqual([]);
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, lng: 200 }),
    ).resolves.not.toEqual([]);
  });

  it('title이 100자를 넘으면 거부한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        title: 'a'.repeat(101),
      }),
    ).resolves.not.toEqual([]);
  });

  it('카테고리는 비어 있을 수 없다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        categorySlugs: [],
      }),
    ).resolves.not.toEqual([]);
  });

  it('카테고리는 중복될 수 없다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        categorySlugs: ['hiking', 'hiking'],
      }),
    ).resolves.not.toEqual([]);
  });

  it('카테고리는 3개를 넘을 수 없다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        categorySlugs: ['a', 'b', 'c', 'd'],
      }),
    ).resolves.not.toEqual([]);
  });

  it('카테고리 슬러그가 30자를 넘으면 거부한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, {
        ...createBody,
        categorySlugs: ['a'.repeat(31)],
      }),
    ).resolves.not.toEqual([]);
  });

  it('정의되지 않은 필드가 섞여 있으면 거부한다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, status: 'CLOSED' }),
    ).resolves.toContain('property status should not exist');
  });

  it('authorId는 바디로 받을 수 없다', async () => {
    await expect(
      messagesOf(CreateTripPostRequestDto, { ...createBody, authorId: 999 }),
    ).resolves.toContain('property authorId should not exist');
  });
});

describe('UpdateTripPostRequestDto', () => {
  it('올바른 값이면 통과한다', async () => {
    await expect(
      messagesOf(UpdateTripPostRequestDto, createBody),
    ).resolves.toEqual([]);
  });

  it('정원은 2명 이상이어야 한다', async () => {
    await expect(
      messagesOf(UpdateTripPostRequestDto, { ...createBody, capacity: 1 }),
    ).resolves.not.toEqual([]);
  });

  it('카테고리는 비어 있을 수 없다', async () => {
    await expect(
      messagesOf(UpdateTripPostRequestDto, {
        ...createBody,
        categorySlugs: [],
      }),
    ).resolves.not.toEqual([]);
  });

  it('status는 바디로 바꿀 수 없다', async () => {
    await expect(
      messagesOf(UpdateTripPostRequestDto, { ...createBody, status: 'OPEN' }),
    ).resolves.toContain('property status should not exist');
  });
});

describe('GetTripPostsRequestDto', () => {
  const transformQuery = async (value: unknown) =>
    (await pipe.transform(
      value,
      metadataOf(GetTripPostsRequestDto, 'query'),
    )) as GetTripPostsRequestDto;

  it('쿼리 문자열을 숫자로 변환한다', async () => {
    const result = await transformQuery({
      lat: '37.5',
      lng: '127.0',
      limit: '10',
      range: '2.5',
      cursor: '30',
    });

    expect(result.lat).toBe(37.5);
    expect(result.lng).toBe(127.0);
    expect(result.limit).toBe(10);
    expect(result.range).toBe(2.5);
    expect(result.cursor).toBe(30);
  });

  it('limit과 range를 생략하면 기본값이 들어간다', async () => {
    const result = await transformQuery({ lat: '37.5', lng: '127.0' });

    expect(result.limit).toBe(DEFAULT_TRIP_POST_PAGE_SIZE);
    expect(result.range).toBe(DEFAULT_TRIP_POST_RANGE_KM);
    expect(result.cursor).toBeUndefined();
  });

  it('위경도는 필수다', async () => {
    await expect(
      messagesOf(GetTripPostsRequestDto, { lng: '127.0' }, 'query'),
    ).resolves.not.toEqual([]);
    await expect(
      messagesOf(GetTripPostsRequestDto, { lat: '37.5' }, 'query'),
    ).resolves.not.toEqual([]);
  });

  it('limit은 1 이상 50 이하만 허용한다', async () => {
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', limit: '0' },
        'query',
      ),
    ).resolves.not.toEqual([]);
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', limit: '51' },
        'query',
      ),
    ).resolves.not.toEqual([]);
  });

  it('range는 0.1 이상 50 이하만 허용한다', async () => {
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', range: '0.05' },
        'query',
      ),
    ).resolves.not.toEqual([]);
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', range: '51' },
        'query',
      ),
    ).resolves.not.toEqual([]);
  });

  it('cursor는 1 이상의 정수만 허용한다', async () => {
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', cursor: '0' },
        'query',
      ),
    ).resolves.not.toEqual([]);
  });

  it('정의되지 않은 쿼리는 거부한다', async () => {
    await expect(
      messagesOf(
        GetTripPostsRequestDto,
        { lat: '37.5', lng: '127.0', orderBy: 'id' },
        'query',
      ),
    ).resolves.toContain('property orderBy should not exist');
  });
});
