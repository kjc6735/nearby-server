import { Injectable } from '@nestjs/common';
import { UserCreateInput, UserWhereUniqueInput } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService
  ){
}

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

}
