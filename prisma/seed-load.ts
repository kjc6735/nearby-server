import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { ParticipationStatus, TripPostStatus } from '../src/generated/prisma/enums';

/**
 * 부하테스트용 대용량 시드.
 *
 * 데이터가 몇 건뿐인 DB에서는 어떤 쿼리든 빠르게 끝나서 측정이 의미가 없다.
 * 운영에서 예상되는 규모를 미리 채워 두고 재야 인덱스 부재나 정렬 비용이 드러난다.
 *
 *   DATABASE_URL="postgresql://nearby:nearby@localhost:5434/nearby" npm run seed:load
 *   USERS=1000 POSTS=5000 npm run seed:load          # 작게
 *   RESET=true npm run seed:load                      # 기존 데이터를 지우고 다시
 *
 * 카테고리는 지우지 않는다(prisma/seed.ts 담당).
 */
const USERS = Number(process.env.USERS || 10_000);
const POSTS = Number(process.env.POSTS || 100_000);
const PARTICIPATIONS_PER_POST = Number(process.env.PARTICIPATIONS_PER_POST || 3);
const BATCH = Number(process.env.BATCH || 5_000);
const RESET = process.env.RESET === 'true';

// k6 스크립트와 같은 비밀번호라, 시드된 계정으로도 로그인해볼 수 있다
const PASSWORD = process.env.SEED_PASSWORD || 'k6-password-1234';
const SALT_ROUNDS = Number(process.env.SALT_OR_ROUND || 10);

const REGIONS = {
  seoul: { minLat: 37.45, maxLat: 37.65, minLng: 126.8, maxLng: 127.15 },
  korea: { minLat: 34.5, maxLat: 38.3, minLng: 126.3, maxLng: 129.4 },
};
const REGION = REGIONS[(process.env.REGION || 'korea') as keyof typeof REGIONS];
if (!REGION) {
  throw new Error(`알 수 없는 REGION: ${process.env.REGION} (${Object.keys(REGIONS).join(', ')})`);
}
const DAY_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** 배열을 BATCH 크기로 잘라 순서대로 넘겨준다. 한 번에 다 넣으면 메모리와 쿼리 크기가 부담된다. */
async function inBatches<T>(
  label: string,
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  const startedAt = Date.now();
  for (let i = 0; i < rows.length; i += BATCH) {
    await insert(rows.slice(i, i + BATCH));
    const done = Math.min(i + BATCH, rows.length);
    process.stdout.write(`\r  ${label}: ${done.toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`\r  ${label}: ${rows.length.toLocaleString()}건 완료 (${seconds}s)\n`);
}

async function reset() {
  console.log('기존 데이터 삭제 중... (카테고리는 유지)');
  // 외래키 때문에 순서가 중요해서 TRUNCATE ... CASCADE로 한 번에 비운다.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Participation", "TripPostCategory", "ChatRoom", "TripPost", "User"
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL이 필요합니다.');
  }
  console.log(`대상: ${process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@')}`);

  if (RESET) await reset();

  const categories = await prisma.category.findMany({ select: { id: true } });
  if (categories.length === 0) {
    throw new Error('카테고리가 없습니다. 먼저 `npm run prisma:seed`를 실행하세요.');
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(
      `이미 사용자 ${existingUsers.toLocaleString()}명이 있습니다. 지우고 다시 채우려면 RESET=true를 주세요.`,
    );
  }

  // bcrypt는 의도적으로 느리다. 계정마다 해시하면 시드에만 몇 시간이 걸리므로
  // 한 번만 만들어 재사용한다. 어차피 모든 계정의 비밀번호가 같다.
  console.log(`\n비밀번호 해시 생성 (rounds=${SALT_ROUNDS})...`);
  const password = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  console.log(`\n사용자 ${USERS.toLocaleString()}명 생성`);
  const now = Date.now();
  const users = Array.from({ length: USERS }, (_, i) => ({
    email: `seed-user-${i}@loadtest.dev`,
    username: `seeduser${i}`,
    name: `시드사용자${i}`,
    password,
    // 가입 시점을 최근 1년에 흩뿌린다
    createdAt: new Date(now - randomInt(0, 365) * DAY_MS),
  }));
  await inBatches('users', users, (chunk) =>
    prisma.user.createMany({ data: chunk, skipDuplicates: true }),
  );

  const userIds = (
    await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } })
  ).map(({ id }) => id);

  console.log(`\n동행 글 ${POSTS.toLocaleString()}건 생성`);
  const posts = Array.from({ length: POSTS }, (_, i) => {
    // 4할은 이미 지난 모임, 6할은 예정된 모임
    const meetOffset = i % 10 < 4 ? -randomInt(1, 180) : randomInt(1, 60);
    const createdAt = new Date(now - randomInt(0, 365) * DAY_MS);

    return {
      title: `시드 동행 ${i} - ${['맛집 탐방', '한강 산책', '전시 관람', '등산', '카페 투어'][i % 5]}`,
      content: `부하테스트용으로 생성된 ${i}번 글입니다. `.repeat(randomInt(1, 10)),
      placeName: ['홍대', '강남', '이태원', '성수', '연남동', '북촌'][i % 6],
      capacity: randomInt(2, 10),
      authorId: userIds[i % userIds.length],
      meetAt: new Date(now + meetOffset * DAY_MS),
      lat: randomBetween(REGION.minLat, REGION.maxLat),
      lng: randomBetween(REGION.minLng, REGION.maxLng),
      status: TripPostStatus.OPEN,
      createdAt,
      // 1할은 소프트 삭제된 글. 삭제 글을 걸러내는 비용도 측정에 포함시킨다.
      deletedAt: i % 10 === 0 ? new Date() : null,
    };
  });
  await inBatches('posts', posts, (chunk) => prisma.tripPost.createMany({ data: chunk }));

  const postIds = (
    await prisma.tripPost.findMany({ select: { id: true }, orderBy: { id: 'asc' } })
  ).map(({ id }) => id);

  console.log(`\n글-카테고리 연결 생성`);
  const postCategories = postIds.flatMap((postId, i) => {
    const count = randomInt(1, 3);
    // 같은 글에 같은 카테고리가 두 번 들어가면 복합 PK에 걸리므로 간격을 두고 고른다
    return Array.from({ length: count }, (_, j) => ({
      tripPostId: postId,
      categoryId: categories[(i + j * 5) % categories.length].id,
    }));
  });
  await inBatches('post-categories', postCategories, (chunk) =>
    prisma.tripPostCategory.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log(`\n참여 신청 생성 (글당 최대 ${PARTICIPATIONS_PER_POST}건)`);
  const statuses = [
    ParticipationStatus.PENDING,
    ParticipationStatus.APPROVED,
    ParticipationStatus.APPROVED,
    ParticipationStatus.REJECTED,
  ];
  const participations = postIds.flatMap((postId, i) => {
    const authorId = userIds[i % userIds.length];
    const rows: {
      tripPostId: number;
      userId: number;
      status: (typeof statuses)[number];
      createdAt: Date;
    }[] = [];

    for (let j = 0; j < PARTICIPATIONS_PER_POST; j++) {
      // (글, 사용자)는 유니크라 겹치지 않게 서로소인 간격으로 고른다
      const userId = userIds[(i + 1 + j * 7919) % userIds.length];
      if (userId === authorId) continue; // 본인 글에는 지원할 수 없다

      rows.push({
        tripPostId: postId,
        userId,
        status: statuses[(i + j) % statuses.length],
        createdAt: new Date(now - randomInt(0, 90) * DAY_MS),
      });
    }
    return rows;
  });
  await inBatches('participations', participations, (chunk) =>
    prisma.participation.createMany({ data: chunk, skipDuplicates: true }),
  );

  // 통계가 낡으면 플래너가 엉뚱한 실행 계획을 골라 측정이 왜곡된다
  console.log('\nANALYZE 실행...');
  await prisma.$executeRawUnsafe('ANALYZE');

  const [userCount, postCount, participationCount] = await Promise.all([
    prisma.user.count(),
    prisma.tripPost.count(),
    prisma.participation.count(),
  ]);

  console.log('\n✅ 시드 완료');
  console.table({
    사용자: userCount.toLocaleString(),
    '동행 글': postCount.toLocaleString(),
    '참여 신청': participationCount.toLocaleString(),
  });
}

main()
  .catch((e) => {
    console.error('\n❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
