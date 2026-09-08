import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthPayload } from '../auth/common/auth.payload';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { UpdateUserRequestDto } from './dto/update-user.request.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}
  @Get('me')
  async getMe(@CurrentUser() currentUser: AuthPayload) {
    const { sub: id } = currentUser;

    return this.userService.getMyProfile({ id });
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser() currentUser: AuthPayload,
    @Body() updateUserRequestDto: UpdateUserRequestDto,
  ) {
    const { sub: id } = currentUser;
    return this.userService.updateMyProfile({
      unique: { id },
      userUpdateInput: { ...updateUserRequestDto },
    });
  }
}
