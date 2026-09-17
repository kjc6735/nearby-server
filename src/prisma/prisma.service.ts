import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

type PrismaServiceOptions = Prisma.PrismaClientOptions & {
  log: { emit: 'event'; level: 'query' }[];
};

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaServiceOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // 쿼리 이벤트는 로그 레벨과 무관하게 매 쿼리마다 발생하므로,
    // 벤치마크 수치에 섞이지 않도록 필요할 때만 켠다.
    const queryLogEnabled = process.env.PRISMA_QUERY_LOG === 'true';

    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
      log: queryLogEnabled ? [{ emit: 'event', level: 'query' }] : [],
    });

    if (queryLogEnabled) {
      // params에는 이메일·비밀번호 해시 같은 값이 들어가므로 남기지 않는다.
      this.$on('query', ({ query, duration }) => {
        this.logger.log({ query, durationMs: duration }, 'Prisma query');
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
