import { Controller, Get, Post } from '@nestjs/common';
import type { AuthPayload } from '../auth/common/auth.payload';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService
  ){}
  @Get('me')
  async getMe(
    @CurrentUser() currentUser: AuthPayload
  ) {
    const { sub: id } = currentUser;
    const user = await this.userService.findOne({id});
    
  }

  @Post('me')
  async updateMyProfile(
    @CurrentUser() currentUser: AuthPayload
  ){

  }
}
