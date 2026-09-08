import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// class-validator는 데코레이터를 아래에서 위 순으로 평가한다.
// stopAtFirstError와 함께 쓰므로, 먼저 보고싶은 검사를 아래쪽에 둔다.
export class SignUpRequestDto {
  @MaxLength(255)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email!: string;

  @MaxLength(72)
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @IsString()
  password!: string;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  username!: string;

  @MaxLength(50)
  @MinLength(1)
  @IsString()
  name!: string;
}
