import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * 기본 카테고리.
 *
 * displayOrder를 10 단위로 띄워둔 이유는, 중간에 새 카테고리를 넣을 때
 * 뒤쪽 값을 전부 다시 매기지 않아도 되게 하기 위함이다. (예: 맛집과 카페
 * 사이에 넣고 싶으면 15를 쓰면 된다)
 */
const CATEGORIES = [
  { slug: 'food', name: '맛집', displayOrder: 10 },
  { slug: 'cafe', name: '카페', displayOrder: 20 },
  { slug: 'drink', name: '술 한잔', displayOrder: 30 },
  { slug: 'walk', name: '산책', displayOrder: 40 },
  { slug: 'hiking', name: '등산', displayOrder: 50 },
  { slug: 'exercise', name: '운동', displayOrder: 60 },
  { slug: 'culture', name: '전시·공연', displayOrder: 70 },
  { slug: 'movie', name: '영화', displayOrder: 80 },
  { slug: 'travel', name: '여행', displayOrder: 90 },
  { slug: 'photo', name: '사진', displayOrder: 100 },
  { slug: 'study', name: '스터디', displayOrder: 110 },
  { slug: 'etc', name: '기타', displayOrder: 999 },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    for (const category of CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name, displayOrder: category.displayOrder },
        create: category,
      });
    }

    console.log(`✅ 카테고리 ${CATEGORIES.length}건 시드 완료`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e);
  process.exit(1);
});
