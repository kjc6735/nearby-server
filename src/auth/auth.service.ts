import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthPayload } from './common/auth.payload';
import type { JwtConfig } from './dto/jwt.config';
@Injectable()
export class AuthService {
    constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject("JWT_CONFIG") private readonly jwtConfig: JwtConfig,
    @Inject("SALT_OR_ROUND") private readonly saltOrRountd: number
  ) {}


  async signIn ({
    email, password
  }: {
    email: string;
    password: string;
  }){

    const user = await this.usersService.findOne({
      email
    });

    if(!user) throw new UnauthorizedException('정보를 다시 확인해주세요.');

    const isMatch = await bcrypt.compare(password, user.password!);
    
    if(!isMatch) {
      throw new UnauthorizedException('정보를 다시 확인해주세요.');
    }
    
    
    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessTokenSecret,
      expiresIn: this.jwtConfig.accessRoate,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshTokenSecret,
      expiresIn: this.jwtConfig.refreshRotate,
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let payload: AuthPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthPayload>(refreshToken, {
        secret: this.jwtConfig.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('토큰이 유효하지 않습니다.');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.jwtConfig.accessTokenSecret,
        expiresIn: this.jwtConfig.accessRoate,
      },
    );

    return { accessToken };
  }

  async signUp(data: { email: string; password: string; username: string; name: string }) {
    
    const {email, password} = data;

    const existing = await this.usersService.findOne({ email });
  
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    const hashed = await bcrypt.hash(password, 10);
    await this.usersService.create({ ...data,  password: hashed });
  }


}
