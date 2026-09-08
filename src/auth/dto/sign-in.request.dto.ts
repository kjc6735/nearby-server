import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SignInRequestDto {
  @MaxLength(255)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email!: string;

  @MaxLength(72)
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  @IsString()
  password!: string;
}
