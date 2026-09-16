import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import type { AuthPayload } from './auth.payload';
import { CurrentUser } from './current-user.decorator';

type ParamFactory = (
  data: keyof AuthPayload | undefined,
  ctx: ExecutionContext,
) => unknown;

// 파라미터 데코레이터의 팩토리는 메타데이터에만 남아서 직접 꺼내 호출한다
const getFactory = (): ParamFactory => {
  class TestController {
    public test(@CurrentUser() user: AuthPayload) {
      return user;
    }
  }

  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'test',
  ) as Record<string, { factory: ParamFactory }>;

  return args[Object.keys(args)[0]].factory;
};

const createContext = (user?: AuthPayload) => {
  const request = { user } as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('CurrentUser', () => {
  const factory = getFactory();
  const payload: AuthPayload = { sub: 1, email: 'user@example.com' };

  it('data가 없으면 payload 전체를 준다', () => {
    expect(factory(undefined, createContext(payload))).toEqual(payload);
  });

  it('data가 sub면 sub만 준다', () => {
    expect(factory('sub', createContext(payload))).toBe(1);
  });

  it('data가 email이면 email만 준다', () => {
    expect(factory('email', createContext(payload))).toBe('user@example.com');
  });

  it('request.user가 없으면 undefined를 준다', () => {
    expect(factory(undefined, createContext())).toBeUndefined();
    expect(factory('sub', createContext())).toBeUndefined();
  });
});
