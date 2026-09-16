import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserRequestDto } from './update-user.request.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const messagesOf = async (value: unknown): Promise<string[]> => {
  try {
    await pipe.transform(value, {
      type: 'body',
      metatype: UpdateUserRequestDto,
      data: undefined,
    });
    return [];
  } catch (e) {
    const response = (e as BadRequestException).getResponse();
    return (response as { message: string[] }).message;
  }
};

describe('UpdateUserRequestDto', () => {
  const body = { name: '새이름', username: 'newname' };

  it('올바른 값이면 통과한다', async () => {
    await expect(messagesOf(body)).resolves.toEqual([]);
  });

  it('name이 빈 문자열이면 거부한다', async () => {
    await expect(messagesOf({ ...body, name: '' })).resolves.not.toEqual([]);
  });

  it('name이 50자를 넘으면 거부한다', async () => {
    await expect(
      messagesOf({ ...body, name: 'a'.repeat(51) }),
    ).resolves.not.toEqual([]);
  });

  it('username은 2자 이상 20자 이하만 허용한다', async () => {
    await expect(messagesOf({ ...body, username: 'a' })).resolves.not.toEqual(
      [],
    );
    await expect(
      messagesOf({ ...body, username: 'a'.repeat(21) }),
    ).resolves.not.toEqual([]);
  });

  it('name과 username은 생략할 수 없다', async () => {
    await expect(messagesOf({ name: '새이름' })).resolves.not.toEqual([]);
    await expect(messagesOf({ username: 'newname' })).resolves.not.toEqual([]);
  });

  it('email처럼 수정 대상이 아닌 필드는 거부한다', async () => {
    await expect(
      messagesOf({ ...body, email: 'hacker@example.com' }),
    ).resolves.toContain('property email should not exist');
  });
});
