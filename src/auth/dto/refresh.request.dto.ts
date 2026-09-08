import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

export class RefreshRequestDto {
  @IsJWT({ message: '토큰이 유효하지 않습니다.' })
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}
