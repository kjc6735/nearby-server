import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guard/auth.guard';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [
    AuthService,
    {
      provide: 'SALT_OR_ROUND',
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        const result = configService.getOrThrow<number>('SALT_OR_ROUND');
        return Number(result);
      },
    },
    {
      provide: 'JWT_CONFIG',
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        const accessTokenSecret =
          configService.getOrThrow<string>('JWT_ACCESS_SECRET');
        const refreshTokenSecret =
          configService.getOrThrow<string>('JWT_REFRESH_SECRET');
        const accessRoate =
          configService.getOrThrow<string>('JWT_ACCESS_ROTATE');
        const refreshRotate =
          configService.getOrThrow<string>('JWT_REFRESH_ROTATE');

        return {
          accessTokenSecret,
          refreshTokenSecret,
          accessRoate,
          refreshRotate,
        };
      },
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
