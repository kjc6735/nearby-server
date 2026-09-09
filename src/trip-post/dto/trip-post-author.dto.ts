import { User } from '../../generated/prisma/client';

export class TripPostAuthorDto {
  constructor(
    private id: number,
    private name: string | null,
    private username: string | null,
  ) {}

  static from(user: User) {
    const { id, name, username } = user;
    return new TripPostAuthorDto(id, name, username);
  }
}
