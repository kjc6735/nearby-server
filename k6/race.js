import { check } from 'k6';
import http from 'k6/http';
import { accessTokenOf, authRequest, prepareUsers } from './lib/auth.js';
import { BASE_URL, JSON_HEADERS, tripPostBody } from './lib/config.js';

/**
 * 동시성 검증. 정원이 CAPACITY인 글에 지원자 여럿을 동시에 승인해서
 * 승인 인원이 정원을 넘지 않는지(오버부킹) 확인한다.
 * 부하량보다 정합성을 보는 테스트라 VU 1개로 http.batch 병렬 요청을 쓴다.
 *
 *   k6 run -e ROUNDS=20 k6/race.js
 */
const CAPACITY = Number(__ENV.CAPACITY || 3);
const APPLICANTS = Number(__ENV.APPLICANTS || 10);

export const options = {
  setupTimeout: '5m',
  scenarios: {
    race: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: Number(__ENV.ROUNDS || 10),
    },
  },
  thresholds: {
    'checks{check:no overbooking}': ['rate==1'],
  },
};

export function setup() {
  return { users: prepareUsers(APPLICANTS + 1) };
}

export default function ({ users }) {
  const [author, ...applicants] = users;

  const created = authRequest(author, 'POST', '/trip-posts', tripPostBody({ capacity: CAPACITY }));
  if (created.status !== 201) throw new Error(`글 생성 실패: ${created.status}`);
  const tripPostId = created.json('id');

  for (const applicant of applicants) {
    authRequest(applicant, 'POST', `/trip-posts/${tripPostId}/participations`);
  }

  const participations = authRequest(author, 'GET', `/trip-posts/${tripPostId}/participations`).json();

  // 모든 지원을 한 번에 승인 요청
  const responses = http.batch(
    participations.map((p) => [
      'PATCH',
      `${BASE_URL}/trip-posts/${tripPostId}/participations/${p.participationId}`,
      JSON.stringify({ status: 'APPROVED' }),
      {
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessTokenOf(author)}` },
        tags: { name: 'PATCH approve (race)' },
      },
    ]),
  );

  const approvedByResponse = responses.filter((r) => r.status === 200).length;
  const after = authRequest(author, 'GET', `/trip-posts/${tripPostId}/participations`).json();
  const approvedInDb = after.filter((p) => p.status === 'APPROVED').length;
  const post = authRequest(author, 'GET', `/trip-posts/${tripPostId}`).json();

  // 정원은 작성자 포함
  const maxApprovable = CAPACITY - 1;
  check(null, {
    'no overbooking': () => approvedInDb <= maxApprovable,
    'response matches db': () => approvedByResponse === approvedInDb,
    'status closed when full': () =>
      approvedInDb < maxApprovable || post.status === 'CLOSED',
  });

  if (approvedInDb > maxApprovable) {
    console.warn(
      `오버부킹: post=${tripPostId} 정원=${CAPACITY} 승인=${approvedInDb}명 (200 응답 ${approvedByResponse}건)`,
    );
  }
}
