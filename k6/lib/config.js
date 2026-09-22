// 부하테스트 공통 설정. 모든 값은 `k6 run -e KEY=value`로 덮어쓸 수 있다.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// setup()에서 미리 만들어 둘 테스트 계정 수
export const USER_COUNT = Number(__ENV.USER_COUNT || 50);
export const USER_PASSWORD = __ENV.USER_PASSWORD || 'k6-password-1234';

// prisma/seed.ts의 카테고리 slug와 맞춰야 한다
export const CATEGORY_SLUGS = [
  'food',
  'cafe',
  'drink',
  'walk',
  'hiking',
  'exercise',
  'culture',
  'movie',
  'travel',
  'photo',
  'study',
  'etc',
];

const REGIONS = {
  seoul: { minLat: 37.45, maxLat: 37.65, minLng: 126.8, maxLng: 127.15 },
  korea: { minLat: 34.5, maxLat: 38.3, minLng: 126.3, maxLng: 129.4 },
};
const REGION = REGIONS[__ENV.REGION || 'korea'];
if (!REGION) {
  throw new Error(
    `알 수 없는 REGION: ${__ENV.REGION} (${Object.keys(REGIONS).join(', ')})`,
  );
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function userEmail(index) {
  return `k6-user-${index}@loadtest.dev`;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomCoord() {
  return {
    lat: REGION.minLat + Math.random() * (REGION.maxLat - REGION.minLat),
    lng: REGION.minLng + Math.random() * (REGION.maxLng - REGION.minLng),
  };
}

export function randomCategorySlugs() {
  const shuffled = [...CATEGORY_SLUGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randomInt(1, 3));
}

export function tripPostBody(overrides = {}) {
  const { lat, lng } = randomCoord();
  return {
    title: `k6 동행 ${Date.now()}`,
    content: '부하테스트로 생성된 글입니다.',
    placeName: '테스트 장소',
    capacity: randomInt(2, 10),
    meetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lat,
    lng,
    categorySlugs: randomCategorySlugs(),
    ...overrides,
  };
}

export const PROFILES = {
  smoke: [{ duration: '30s', target: 2 }],
  load: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  stress: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  spike: [
    { duration: '30s', target: 10 },
    { duration: '10s', target: 300 },
    { duration: '1m', target: 300 },
    { duration: '10s', target: 10 },
    { duration: '30s', target: 0 },
  ],
};

export function stagesFor(profile) {
  const stages = PROFILES[profile];
  if (!stages) {
    throw new Error(
      `알 수 없는 PROFILE: ${profile} (${Object.keys(PROFILES).join(', ')})`,
    );
  }
  return stages;
}
