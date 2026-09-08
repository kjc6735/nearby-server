import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guard/auth.guard';

@Module({
  imports:[
    UsersModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService, 
    {
      provide: "SALT_OR_ROUND",
      inject: [ConfigService],
      async useFactory(configService: ConfigService) {
        const result =  await configService.getOrThrow<number>('SALT_OR_ROUND')      
        return Number(result)
      },
    },
    {
      provide: "JWT_CONFIG",
      inject: [ConfigService],
      async useFactory(configService: ConfigService) {
        const accessTokenSecret = await configService.getOrThrow("JWT_ACCESS_SECRET");
        const refreshTokenSecret = await configService.getOrThrow("JWT_REFRESH_SECRET");
        const accessRoate = await configService.getOrThrow("JWT_ACCESS_ROTATE"); 
        const refreshRotate = await configService.getOrThrow("JWT_REFRESH_ROTATE"); 

        return {
          accessTokenSecret,
          refreshTokenSecret,
          accessRoate,
          refreshRotate
        } 
      }
    }, {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
