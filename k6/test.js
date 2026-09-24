import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { authRequest, prepareUsers } from './lib/auth.js';
import {
  BASE_URL,
  randomCoord,
  randomInt,
  randomItem,
  rangeKm,
  stagesFor,
  tripPostBody,
} from './lib/config.js';

const PROFILE = __ENV.PROFILE || 'smoke';
const stages = stagesFor(PROFILE);

// 실제 서비스처럼 조회가 대부분이고 쓰기는 일부라고 가정한 비율
const BROWSE_WEIGHT = 0.8;
const WRITE_WEIGHT = 0.1;

export const options = {
  setupTimeout: '5m',
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      tags: { phase: 'main' },
      stages: scaleStages(stages, BROWSE_WEIGHT),
    },
    write: {
      executor: 'ramping-vus',
      exec: 'write',
      tags: { phase: 'main' },
      stages: scaleStages(stages, WRITE_WEIGHT),
    },
    participation: {
      executor: 'ramping-vus',
      exec: 'participation',
      tags: { phase: 'main' },
      stages: scaleStages(stages, 1 - BROWSE_WEIGHT - WRITE_WEIGHT),
    },
  },
  // setup()의 가입·로그인(bcrypt)이 섞이지 않도록 본 시나리오 요청만 본다
  thresholds: {
    'http_req_failed{phase:main}': ['rate<0.01'],
    'http_req_duration{phase:main}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{name:GET /trip-posts}': ['p(95)<300'],
    'http_req_duration{name:GET /trip-posts/:id}': ['p(95)<200'],
    'http_req_duration{name:POST /trip-posts}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

function scaleStages(base, weight) {
  return base.map(({ duration, target }) => ({
    duration,
    target: target === 0 ? 0 : Math.max(1, Math.round(target * weight)),
  }));
}

export function setup() {
  const health = http.get(`${BASE_URL}/categories`);
  if (health.status !== 200) {
    throw new Error(`서버에 연결할 수 없습니다: ${BASE_URL} (${health.status})`);
  }
  if (health.json().length === 0) {
    throw new Error('카테고리가 비어 있습니다. `npm run prisma:seed`를 먼저 실행하세요.');
  }

  const users = prepareUsers();

  // 목록·상세 조회가 빈 결과만 받지 않도록 글을 미리 깔아둔다
  const postIds = [];
  for (let i = 0; i < Number(__ENV.SEED_POSTS || 30); i++) {
    const res = authRequest(users[i % users.length], 'POST', '/trip-posts', tripPostBody(), {
      tags: { name: 'setup' },
    });
    if (res.status === 201) postIds.push(res.json('id'));
  }

  console.log(`PROFILE=${PROFILE}, 사용자 ${users.length}명, 시드 글 ${postIds.length}건`);
  return { users, postIds };
}

// 비로그인·로그인 사용자가 주변 글을 둘러보는 흐름
export function browse({ users, postIds }) {
  const user = randomItem(users);

  group('browse', () => {
    const categories = http.get(`${BASE_URL}/categories`, {
      tags: { name: 'GET /categories' },
    });
    check(categories, { 'categories 200': (r) => r.status === 200 });

    const { lat, lng } = randomCoord();
    // 반경은 한 번만 뽑아 다음 페이지까지 같은 값을 쓴다.
    // 페이지마다 반경이 달라지면 결과 집합 자체가 바뀌어 커서 페이지네이션을 잰 게 아니게 된다.
    const range = rangeKm();
    const list = authRequest(
      user,
      'GET',
      `/trip-posts?lat=${lat}&lng=${lng}&range=${range}&limit=20`,
      null,
      { tags: { name: 'GET /trip-posts' } },
    );
    check(list, { 'list 200': (r) => r.status === 200 });

    // 다음 페이지까지 내려보는 사용자
    const nextCursor = list.status === 200 ? list.json('nextCursor') : null;
    if (nextCursor && Math.random() < 0.3) {
      const next = authRequest(
        user,
        'GET',
        `/trip-posts?lat=${lat}&lng=${lng}&range=${range}&limit=20&cursor=${nextCursor}`,
        null,
        { tags: { name: 'GET /trip-posts' } },
      );
      check(next, { 'list next page 200': (r) => r.status === 200 });
    }

    const listed = list.status === 200 ? list.json('items') : [];
    const postId = listed.length > 0 ? randomItem(listed).id : randomItem(postIds);
    if (postId) {
      const detail = authRequest(user, 'GET', `/trip-posts/${postId}`, null, {
        tags: { name: 'GET /trip-posts/:id' },
        // 다른 VU가 방금 지운 글일 수 있다
        responseCallback: http.expectedStatuses(200, 404),
      });
      check(detail, { 'detail 200/404': (r) => r.status === 200 || r.status === 404 });
    }

    const me = authRequest(user, 'GET', '/users/me', null, {
      tags: { name: 'GET /users/me' },
    });
    check(me, { 'me 200': (r) => r.status === 200 });
  });

  sleep(randomInt(1, 3));
}

// 글 작성 → 수정 → (일부) 삭제
export function write({ users }) {
  const user = randomItem(users);

  group('write', () => {
    const created = authRequest(user, 'POST', '/trip-posts', tripPostBody(), {
      tags: { name: 'POST /trip-posts' },
    });
    if (!check(created, { 'create 201': (r) => r.status === 201 })) return;

    const id = created.json('id');
    sleep(1);

    const updated = authRequest(
      user,
      'PUT',
      `/trip-posts/${id}`,
      tripPostBody({ title: `k6 수정된 동행 ${id}`, capacity: 10 }),
      { tags: { name: 'PUT /trip-posts/:id' } },
    );
    check(updated, { 'update 200': (r) => r.status === 200 });

    if (Math.random() < 0.3) {
      const deleted = authRequest(user, 'DELETE', `/trip-posts/${id}`, null, {
        tags: { name: 'DELETE /trip-posts/:id' },
      });
      check(deleted, { 'delete 204': (r) => r.status === 204 });
    }
  });

  sleep(randomInt(2, 5));
}

// 작성자 글 생성 → 다른 사용자 지원 → 작성자 목록 조회 → 승인/거절 또는 지원자 취소
export function participation({ users }) {
  const author = randomItem(users);
  let applicant = randomItem(users);
  while (users.length > 1 && applicant.email === author.email) {
    applicant = randomItem(users);
  }

  group('participation', () => {
    const created = authRequest(author, 'POST', '/trip-posts', tripPostBody({ capacity: 5 }), {
      tags: { name: 'POST /trip-posts' },
    });
    if (!check(created, { 'create 201': (r) => r.status === 201 })) return;
    const tripPostId = created.json('id');

    const applied = authRequest(applicant, 'POST', `/trip-posts/${tripPostId}/participations`, null, {
      tags: { name: 'POST /trip-posts/:id/participations' },
    });
    if (!check(applied, { 'apply 201': (r) => r.status === 201 })) return;

    const list = authRequest(author, 'GET', `/trip-posts/${tripPostId}/participations`, null, {
      tags: { name: 'GET /trip-posts/:id/participations' },
    });
    if (!check(list, { 'participations 200': (r) => r.status === 200 })) return;

    const mine = list.json().find((p) => p.userId === applicant.id);
    if (!check(mine, { 'applicant listed': (p) => p !== undefined })) return;

    const roll = Math.random();
    if (roll < 0.2) {
      const canceled = authRequest(
        applicant,
        'DELETE',
        `/trip-posts/${tripPostId}/participations/${mine.participationId}`,
        null,
        { tags: { name: 'DELETE /trip-posts/:id/participations/:pid' } },
      );
      check(canceled, { 'cancel 200': (r) => r.status === 200 });
    } else {
      const changed = authRequest(
        author,
        'PATCH',
        `/trip-posts/${tripPostId}/participations/${mine.participationId}`,
        { status: roll < 0.8 ? 'APPROVED' : 'REJECTED' },
        { tags: { name: 'PATCH /trip-posts/:id/participations/:pid' } },
      );
      check(changed, { 'change status 200': (r) => r.status === 200 });
    }
  });

  sleep(randomInt(1, 3));
}
