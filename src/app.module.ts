import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { createLoggerParams } from './logger/logger.config';
import { ParticipationsModule } from './participations/participations.module';
import { PrismaModule } from './prisma/prisma.module';
import { TripPostModule } from './trip-post/trip-post.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'dev' ? '.env.dev' : '.env',
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        return createLoggerParams({
          level: configService.get<string>('LOG_LEVEL', 'info'),
          pretty: configService.get<string>('LOG_PRETTY') === 'true',
        });
      },
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TripPostModule,
    ParticipationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
