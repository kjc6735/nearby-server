import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // ts-node는 생성된 클라이언트의 './internal/class.js' 같은
    // 확장자 지정 import를 .ts로 되짚지 못한다. tsx는 처리한다.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
