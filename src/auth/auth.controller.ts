import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './common/public.decorator';
import { RefreshRequestDto } from './dto/refresh.request.dto';
import { SignInRequestDto } from './dto/sign-in.request.dto';
import { SignUpRequestDto } from './dto/sigin-up.request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService
  ){}

  @Public()
  @Post('sign-in')
  async signIn(
    @Body() signInRerquestDto: SignInRequestDto,
    @Res({ passthrough: true }) res: Response,
  ){
    const { accessToken, refreshToken } = await this.authService.signIn(signInRerquestDto);

    res.setHeader('Authorization', `Bearer ${accessToken}`);

    return { accessToken, refreshToken };
  }

  @Public()
  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body() signUpRequestDto: SignUpRequestDto) {
    await this.authService.signUp(signUpRequestDto);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() refreshRequestDto: RefreshRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.refresh(refreshRequestDto.refreshToken);

    res.setHeader('Authorization', `Bearer ${accessToken}`);

    return { accessToken };
  }

}
