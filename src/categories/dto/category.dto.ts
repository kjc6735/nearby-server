import { Category } from '../../generated/prisma/client';

export class CategoryDto {
  constructor(
    private slug: string,
    private name: string,
    private displayOrder: number,
  ) {}

  static from(category: Category) {
    const { slug, name, displayOrder } = category;
    return new CategoryDto(slug, name, displayOrder);
  }

  static fromMany(categories: Category[]) {
    return categories.map((category) => CategoryDto.from(category));
  }
}
