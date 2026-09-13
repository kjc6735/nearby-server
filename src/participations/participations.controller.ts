import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthPayload } from '../auth/common/auth.payload';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ChangeApplicationStatusRequestDto } from './dto/change-application-status.request.dto';
import { ParticipationsService } from './participations.service';

@Controller('trip-posts/:tripPostId/participations')
export class ParticipationsController {
  constructor(private readonly participationsService: ParticipationsService) {}

  @Post('')
  async applyForTripPost(
    @CurrentUser() currentUser: AuthPayload,
    @Param('tripPostId', ParseIntPipe) tripPostId: number,
  ) {
    const { sub: userId } = currentUser;
    await this.participationsService.applyForTripPost({
      userId,
      tripPostId,
    });
  }

  @Delete(':participationId')
  async cancelMyApplication(
    @CurrentUser() currentUser: AuthPayload,
    @Param('tripPostId', ParseIntPipe) tripPostId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    const { sub: userId } = currentUser;
    await this.participationsService.cancelMyApplication({
      userId,
      participationId,
      tripPostId,
    });
  }

  @Patch(':participationId')
  async changeApplicationStatusByAuthor(
    @CurrentUser() currentUser: AuthPayload,
    @Param('tripPostId', ParseIntPipe) tripPostId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body()
    changeApplicationStatusRequestDto: ChangeApplicationStatusRequestDto,
  ) {
    const { sub: authorId } = currentUser;
    await this.participationsService.changeApplicationStatusByAuthor({
      authorId,
      participationId,
      tripPostId,
      status: changeApplicationStatusRequestDto.status,
    });
  }
}
