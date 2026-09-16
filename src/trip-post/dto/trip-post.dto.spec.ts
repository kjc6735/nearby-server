import {
  Category,
  Participation,
  TripPost,
  User,
} from '../../generated/prisma/client';
import {
  ParticipationStatus,
  TripPostStatus,
} from '../../generated/prisma/enums';
import { TripPostDto, TripPostDtoSource } from './trip-post.dto';

const MEET_AT = new Date('2026-10-01T09:00:00Z');
const JOINED_AT = new Date('2026-02-01T00:00:00Z');

const createUser = (overrides: Partial<User> = {}): User => ({
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

const createParticipation = (
  overrides: Partial<Participation> = {},
): Participation => ({
  id: 500,
  tripPostId: 100,
  userId: 2,
  status: ParticipationStatus.PENDING,
  createdAt: JOINED_AT,
  updatedAt: JOINED_AT,
  ...overrides,
});

const createTripPost = (overrides: Partial<TripPost> = {}): TripPost => ({
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
  ...overrides,
});

const createSource = (
  overrides: Partial<TripPostDtoSource> = {},
): TripPostDtoSource => ({
  ...createTripPost(),
  author: createUser(),
  ...overrides,
});

describe('TripPostDto', () => {
  it('글과 작성자를 DTO로 변환한다', () => {
    const result = TripPostDto.from(createSource());

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
    });
  });

  it('작성자의 email과 password는 노출하지 않는다', () => {
    const serialized = JSON.stringify(TripPostDto.from(createSource()));

    expect(serialized).not.toContain('author@example.com');
    expect(serialized).not.toContain('hashed-password');
  });

  it('categories가 있으면 CategoryDto로 변환한다', () => {
    const result = TripPostDto.from(
      createSource({ categories: [{ category: createCategory() }] }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        categories: [{ slug: 'hiking', name: '등산', displayOrder: 1 }],
      }),
    );
  });

  it('categories가 없으면 undefined로 둔다', () => {
    const result = TripPostDto.from(createSource());

    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty('categories');
  });

  it('participations가 있으면 ParticipationDto로 변환한다', () => {
    const result = TripPostDto.from(
      createSource({
        participations: [
          {
            ...createParticipation(),
            user: createUser({
              id: 2,
              email: 'applicant@example.com',
              username: 'applicant',
            }),
          },
        ],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        participations: [
          {
            participationId: 500,
            userId: 2,
            username: 'applicant',
            email: 'applicant@example.com',
            joinedAt: JOINED_AT,
            status: ParticipationStatus.PENDING,
          },
        ],
      }),
    );
  });

  it('participations가 없으면 undefined로 둔다', () => {
    const result = TripPostDto.from(createSource());

    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty(
      'participations',
    );
  });

  it('fromMany는 목록을 그대로 변환한다', () => {
    const result = TripPostDto.fromMany([
      createSource({ id: 1 }),
      createSource({ id: 2 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ]);
  });

  it('fromMany에 빈 배열을 주면 빈 배열을 반환한다', () => {
    expect(TripPostDto.fromMany([])).toEqual([]);
  });
});
