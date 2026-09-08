import { IsString, MaxLength, MinLength } from 'class-validator';

// 데코레이터가 없으면 ValidationPipe의 whitelist가 전 필드를 걸러내
// forbidNonWhitelisted에 막힌다. 회원가입 DTO와 같은 제약을 건다.
export class UpdateUserRequestDto {
  @MaxLength(50)
  @MinLength(1)
  @IsString()
  name!: string;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  username!: string;
}
