import {
  Participation,
  ParticipationStatus,
  User,
} from '../../generated/prisma/client';

export type ParticipationWithUser = Participation & { user: User };

export class ParticipationDto {
  constructor(
    private participationId: number,
    private userId: number,
    private username: string,
    private email: string,
    private joinedAt: Date,
    private status: ParticipationStatus,
  ) {}

  static from(participation: ParticipationWithUser) {
    const { id, user, createdAt: joinedAt, status } = participation;
    return new ParticipationDto(
      id,
      user.id,
      user.username!,
      user.email,
      joinedAt,
      status,
    );
  }

  static fromMany(participation: ParticipationWithUser[]) {
    return participation.map((participation) =>
      ParticipationDto.from(participation),
    );
  }
}
