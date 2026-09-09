import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TripPostController } from './trip-post.controller';
import { TripPostService } from './trip-post.service';

@Module({
  imports: [CategoriesModule],
  providers: [TripPostService],
  exports: [TripPostService],
  controllers: [TripPostController],
})
export class TripPostModule {}
