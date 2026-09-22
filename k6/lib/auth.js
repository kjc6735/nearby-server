import http from 'k6/http';
import {
  BASE_URL,
  JSON_HEADERS,
  USER_COUNT,
  USER_PASSWORD,
  userEmail,
} from './config.js';

/**
 * 테스트 계정을 만들고 로그인해 토큰 목록을 돌려준다. setup()에서 한 번만 호출한다.
 * bcrypt 비용 때문에 반복마다 로그인하면 로그인 API 부하가 결과를 덮어버리므로
 * 토큰은 미리 발급받아 VU들이 나눠 쓴다.
 */
export function prepareUsers(count = USER_COUNT) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const email = userEmail(i);

    const signUp = http.post(
      `${BASE_URL}/auth/sign-up`,
      JSON.stringify({
        email,
        password: USER_PASSWORD,
        username: `k6user${i}`,
        name: `부하${i}`,
      }),
      {
        headers: JSON_HEADERS,
        tags: { name: 'setup' },
        // 409는 이전 실행에서 이미 만든 계정이라 실패로 집계하지 않는다
        responseCallback: http.expectedStatuses(201, 409),
      },
    );
    if (signUp.status !== 201 && signUp.status !== 409) {
      throw new Error(`회원가입 실패 (${email}): ${signUp.status} ${signUp.body}`);
    }

    const signIn = http.post(
      `${BASE_URL}/auth/sign-in`,
      JSON.stringify({ email, password: USER_PASSWORD }),
      { headers: JSON_HEADERS, tags: { name: 'setup' } },
    );
    if (signIn.status !== 201) {
      throw new Error(`로그인 실패 (${email}): ${signIn.status} ${signIn.body}`);
    }

    const { accessToken, refreshToken } = signIn.json();
    const me = http.get(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      tags: { name: 'setup' },
    });

    users.push({ id: me.json('id'), email, accessToken, refreshToken });
  }

  return users;
}

// setup 데이터는 VU 안에서 읽기 전용이라, 재발급한 토큰은 VU별로 따로 들고 있는다
const refreshedTokens = {};

export function accessTokenOf(user) {
  return refreshedTokens[user.email] || user.accessToken;
}

/**
 * 인증이 필요한 요청을 보낸다. 액세스 토큰이 만료돼 401이 나면
 * 리프레시 토큰으로 재발급받아 한 번 더 시도한다.
 */
export function authRequest(user, method, path, body, params = {}) {
  const send = () =>
    http.request(method, `${BASE_URL}${path}`, body ? JSON.stringify(body) : null, {
      ...params,
      headers: {
        ...JSON_HEADERS,
        ...(params.headers || {}),
        Authorization: `Bearer ${accessTokenOf(user)}`,
      },
    });

  const res = send();
  if (res.status !== 401) return res;

  const refresh = http.post(
    `${BASE_URL}/auth/refresh`,
    JSON.stringify({ refreshToken: user.refreshToken }),
    { headers: JSON_HEADERS, tags: { name: 'POST /auth/refresh' } },
  );
  if (refresh.status !== 201) return res;

  refreshedTokens[user.email] = refresh.json('accessToken');
  return send();
}
