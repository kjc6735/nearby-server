import { Participation, User } from '../../generated/prisma/client';

export class ParticipationDto {
  constructor(
    private userId: number,
    private username: string,
    private email: string,
    private joinedAt: Date,
  ) {}

  static from(participation: Participation & { user: User }) {
    const { user, createdAt: joinedAt } = participation;
    return new ParticipationDto(user.id, user.username!, user.email, joinedAt);
  }
}
