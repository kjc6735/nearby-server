import { Module } from '@nestjs/common';
import { TripPostModule } from '../trip-post/trip-post.module';
import { UsersModule } from '../users/users.module';
import { ParticipationsController } from './participations.controller';
import { ParticipationsService } from './participations.service';

@Module({
  imports: [UsersModule, TripPostModule],
  providers: [ParticipationsService],
  exports: [ParticipationsService],
  controllers: [ParticipationsController],
})
export class ParticipationsModule {}
