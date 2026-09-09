import { User } from '../../generated/prisma/client';

export class UserDto {
  constructor(
    private id: number,
    private email: string,
    private name: string | null,
    private username: string | null,
  ) {}

  static from(user: User) {
    const { id, email, name, username } = user;
    return new UserDto(id, email, name, username);
  }
}
