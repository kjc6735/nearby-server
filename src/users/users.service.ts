import { BadRequestException, Injectable } from '@nestjs/common';
import { UserCreateInput, UserUpdateInput, UserWhereUniqueInput } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService
  ){
}
  //query
  async getMyProfile(
    unique: UserWhereUniqueInput
  ): Promise<UserDto> {
    const user = await this.findOne(unique);
    if(!user) throw new BadRequestException("정보를 다시 확인해주세요.");

    return UserDto.from(user);
  }

  async updateMyProfile(
    {
      unique, userUpdateInput
    }: {
      unique: UserWhereUniqueInput,
      userUpdateInput: UserUpdateInput
    }
  ){


    const user = await this.findOne(unique);
    if(!user) throw new BadRequestException("정보를 다시 확인해주세요.");

    const updateduser = await this.update(unique, userUpdateInput);
    
    return UserDto.from(updateduser);
  }

  // core
  async findOne( 
    unique: UserWhereUniqueInput
  ){
    return this.prismaService.user.findUnique({
      where: unique
    });
  }

  async create(data: UserCreateInput) {
    return this.prismaService.user.create({data})
  }

  async update (unique: UserWhereUniqueInput, data: UserUpdateInput){
    const updatedUser = await this.prismaService.user.update({
      where: unique, 
      data
    })

    return updatedUser;
  }
}
