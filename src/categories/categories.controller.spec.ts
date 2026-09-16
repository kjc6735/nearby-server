import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: { categoriesQuery: jest.Mock };

  beforeEach(async () => {
    categoriesService = { categoriesQuery: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: categoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  describe('getActiveCategories', () => {
    it('활성 카테고리만 조회한다', async () => {
      const categories = [{ slug: 'hiking', name: '등산', displayOrder: 1 }];
      categoriesService.categoriesQuery.mockResolvedValue(categories);

      await expect(controller.getActiveCategories()).resolves.toBe(categories);
      expect(categoriesService.categoriesQuery).toHaveBeenCalledWith({
        categoryWhereInput: { isActive: true },
      });
    });

    it('서비스가 던진 에러를 그대로 전파한다', async () => {
      categoriesService.categoriesQuery.mockRejectedValue(new Error('db down'));

      await expect(controller.getActiveCategories()).rejects.toThrow('db down');
    });
  });
});
