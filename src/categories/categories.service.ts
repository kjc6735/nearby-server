import { Injectable } from '@nestjs/common';
import {
  CategoryCreateInput,
  CategoryWhereInput,
  CategoryWhereUniqueInput,
} from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async categoriesQuery({
    categoryWhereInput,
  }: {
    categoryWhereInput: CategoryWhereInput;
  }) {
    const categories = await this.getCategories({
      categoryWhereInput,
    });
    return CategoryDto.fromMany(categories);
  }

  //core
  async getCategories({
    categoryWhereInput,
  }: {
    categoryWhereInput: CategoryWhereInput;
  }) {
    return this.prismaService.category.findMany({
      where: categoryWhereInput,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getCategory(unique: CategoryWhereUniqueInput) {
    return this.prismaService.category.findUnique({ where: unique });
  }

  async create(categoryCreateInput: CategoryCreateInput) {
    return this.prismaService.category.create({
      data: categoryCreateInput,
    });
  }

  async delete(unique: CategoryWhereUniqueInput) {
    return this.prismaService.category.delete({ where: unique });
  }
}
