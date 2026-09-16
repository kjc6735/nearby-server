import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ParticipationStatus } from '../../generated/prisma/enums';
import { ChangeApplicationStatusRequestDto } from './change-application-status.request.dto';

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
      metatype: ChangeApplicationStatusRequestDto,
      data: undefined,
    });
    return [];
  } catch (e) {
    const response = (e as BadRequestException).getResponse();
    return (response as { message: string[] }).message;
  }
};

describe('ChangeApplicationStatusRequestDto', () => {
  it('APPROVED와 REJECTED는 통과한다', async () => {
    await expect(
      messagesOf({ status: ParticipationStatus.APPROVED }),
    ).resolves.toEqual([]);
    await expect(
      messagesOf({ status: ParticipationStatus.REJECTED }),
    ).resolves.toEqual([]);
  });

  it('PENDING으로는 되돌릴 수 없다', async () => {
    await expect(
      messagesOf({ status: ParticipationStatus.PENDING }),
    ).resolves.not.toEqual([]);
  });

  it('없는 상태값은 거부한다', async () => {
    await expect(messagesOf({ status: 'DELETED' })).resolves.not.toEqual([]);
  });

  it('status가 없으면 거부한다', async () => {
    await expect(messagesOf({})).resolves.not.toEqual([]);
  });

  it('정의되지 않은 필드가 섞여 있으면 거부한다', async () => {
    await expect(
      messagesOf({ status: ParticipationStatus.APPROVED, participationId: 1 }),
    ).resolves.toContain('property participationId should not exist');
  });
});
