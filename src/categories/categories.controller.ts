import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/common/public.decorator';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  async getActiveCategories() {
    return this.categoriesService.categoriesQuery({
      categoryWhereInput: {
        isActive: true,
      },
    });
  }
}
