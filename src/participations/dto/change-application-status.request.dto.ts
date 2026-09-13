import { IsIn } from 'class-validator';
import { ParticipationStatus } from '../../generated/prisma/enums';

export class ChangeApplicationStatusRequestDto {
  @IsIn([ParticipationStatus.APPROVED, ParticipationStatus.REJECTED])
  status!:
    typeof ParticipationStatus.APPROVED | typeof ParticipationStatus.REJECTED;
}
