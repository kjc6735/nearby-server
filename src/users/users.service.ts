import { Injectable, NotFoundException } from '@nestjs/common';
import {
  UserCreateInput,
  UserUpdateInput,
  UserWhereUniqueInput,
} from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}
  //query
  async getMyProfile(unique: UserWhereUniqueInput): Promise<UserDto> {
    const user = await this.findOne(unique);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    return UserDto.from(user);
  }

  async updateMyProfile({
    unique,
    userUpdateInput,
  }: {
    unique: UserWhereUniqueInput;
    userUpdateInput: {
      name: string;
      username: string;
    };
  }): Promise<UserDto> {
    const user = await this.findOne(unique);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const updateduser = await this.update(unique, userUpdateInput);

    return UserDto.from(updateduser);
  }

  // core
  async findOne(unique: UserWhereUniqueInput) {
    return this.prismaService.user.findUnique({
      where: unique,
    });
  }

  async create(data: UserCreateInput) {
    return this.prismaService.user.create({ data });
  }

  async update(unique: UserWhereUniqueInput, data: UserUpdateInput) {
    const updatedUser = await this.prismaService.user.update({
      where: unique,
      data,
    });

    return updatedUser;
  }
}
