import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RefreshRequestDto } from './refresh.request.dto';
import { SignUpRequestDto } from './sigin-up.request.dto';
import { SignInRequestDto } from './sign-in.request.dto';

// main.ts의 전역 파이프와 같은 옵션으로 실제 동작을 확인한다
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const messagesOf = async (
  metatype: new () => object,
  value: unknown,
): Promise<string[]> => {
  try {
    await pipe.transform(value, { type: 'body', metatype, data: undefined });
    return [];
  } catch (e) {
    const response = (e as BadRequestException).getResponse();
    return (response as { message: string[] }).message;
  }
};

const signUpBody = {
  email: 'new@example.com',
  password: 'plain-password',
  username: 'newbie',
  name: '신규',
};

describe('SignUpRequestDto', () => {
  it('올바른 값이면 통과한다', async () => {
    await expect(messagesOf(SignUpRequestDto, signUpBody)).resolves.toEqual([]);
  });

  it('이메일 형식이 아니면 거부한다', async () => {
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, email: 'not-an-email' }),
    ).resolves.toContain('올바른 이메일 형식이 아닙니다.');
  });

  it('비밀번호가 8자 미만이면 거부한다', async () => {
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, password: 'short' }),
    ).resolves.toContain('비밀번호는 8자 이상이어야 합니다.');
  });

  it('비밀번호가 72자를 넘으면 거부한다', async () => {
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, password: 'a'.repeat(73) }),
    ).resolves.not.toEqual([]);
  });

  it('stopAtFirstError라서 필드당 메시지는 하나만 나온다', async () => {
    const messages = await messagesOf(SignUpRequestDto, {
      ...signUpBody,
      password: 'a',
    });

    expect(messages).toHaveLength(1);
  });

  it('데코레이터를 아래에서 위로 평가해 타입 검사가 먼저 걸린다', async () => {
    const messages = await messagesOf(SignUpRequestDto, {
      ...signUpBody,
      password: 12345678,
    });

    expect(messages).toContain('password must be a string');
    expect(messages).not.toContain('비밀번호는 8자 이상이어야 합니다.');
  });

  it('username은 2자 이상 20자 이하만 허용한다', async () => {
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, username: 'a' }),
    ).resolves.not.toEqual([]);
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, username: 'a'.repeat(21) }),
    ).resolves.not.toEqual([]);
  });

  it('name은 빈 문자열을 허용하지 않는다', async () => {
    await expect(
      messagesOf(SignUpRequestDto, { ...signUpBody, name: '' }),
    ).resolves.not.toEqual([]);
  });

  it('정의되지 않은 필드가 섞여 있으면 거부한다', async () => {
    const messages = await messagesOf(SignUpRequestDto, {
      ...signUpBody,
      isAdmin: true,
    });

    expect(messages).toContain('property isAdmin should not exist');
  });
});

describe('SignInRequestDto', () => {
  const signInBody = { email: 'user@example.com', password: 'plain-password' };

  it('올바른 값이면 통과한다', async () => {
    await expect(messagesOf(SignInRequestDto, signInBody)).resolves.toEqual([]);
  });

  it('이메일 형식이 아니면 거부한다', async () => {
    await expect(
      messagesOf(SignInRequestDto, { ...signInBody, email: 'not-an-email' }),
    ).resolves.toContain('올바른 이메일 형식이 아닙니다.');
  });

  it('비밀번호가 비어 있으면 거부한다', async () => {
    await expect(
      messagesOf(SignInRequestDto, { ...signInBody, password: '' }),
    ).resolves.toContain('비밀번호를 입력해주세요.');
  });

  it('정의되지 않은 필드가 섞여 있으면 거부한다', async () => {
    await expect(
      messagesOf(SignInRequestDto, { ...signInBody, role: 'admin' }),
    ).resolves.toContain('property role should not exist');
  });
});

describe('RefreshRequestDto', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

  it('JWT 형식이면 통과한다', async () => {
    await expect(
      messagesOf(RefreshRequestDto, { refreshToken: token }),
    ).resolves.toEqual([]);
  });

  it('JWT 형식이 아니면 거부한다', async () => {
    await expect(
      messagesOf(RefreshRequestDto, { refreshToken: 'not-a-jwt' }),
    ).resolves.toContain('토큰이 유효하지 않습니다.');
  });

  it('비어 있으면 거부한다', async () => {
    await expect(
      messagesOf(RefreshRequestDto, { refreshToken: '' }),
    ).resolves.not.toEqual([]);
  });
});
