import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthPayload } from '../auth/common/auth.payload';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { CreateTripPostRequestDto } from './dto/create-trip-post.request.dto';
import { GetTripPostsRequestDto } from './dto/get-trip-posts.request.dto';
import { UpdateTripPostRequestDto } from './dto/update-trip-post.request.dto';
import { TripPostService } from './trip-post.service';

@Controller('trip-posts')
export class TripPostController {
  constructor(private readonly tripPostService: TripPostService) {}

  @Get()
  async getTripPosts(@Query() getTripPostsRequestDto: GetTripPostsRequestDto) {
    return this.tripPostService.getTripPosts({ getTripPostsRequestDto });
  }

  @Post()
  async create(
    @CurrentUser() currentUser: AuthPayload,
    @Body() createTripPostRequestDto: CreateTripPostRequestDto,
  ) {
    const { sub: authorId } = currentUser;

    return this.tripPostService.createTripPost({
      authorId,
      createTripPostRequestDto,
    });
  }

  @Put(':id')
  async update(
    @CurrentUser() currentUser: AuthPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTripPostRequestDto: UpdateTripPostRequestDto,
  ) {
    const { sub: authorId } = currentUser;

    return this.tripPostService.updateTripPost({
      id,
      authorId,
      updateTripPostRequestDto,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() currentUser: AuthPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { sub: authorId } = currentUser;

    await this.tripPostService.deletePost({ id, authorId });
  }
}
