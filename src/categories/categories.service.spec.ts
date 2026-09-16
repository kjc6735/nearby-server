import { Test, TestingModule } from '@nestjs/testing';
import { Category } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 10,
  slug: 'hiking',
  name: '등산',
  displayOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('categoriesQuery', () => {
    it('카테고리를 DTO로 변환해 반환한다', async () => {
      prisma.category.findMany.mockResolvedValue([
        createCategory(),
        createCategory({ id: 11, slug: 'cafe', name: '카페', displayOrder: 2 }),
      ]);

      const result = await service.categoriesQuery({
        categoryWhereInput: { isActive: true },
      });

      expect(result).toEqual([
        { slug: 'hiking', name: '등산', displayOrder: 1 },
        { slug: 'cafe', name: '카페', displayOrder: 2 },
      ]);
    });

    it('내부 id와 isActive는 노출하지 않는다', async () => {
      prisma.category.findMany.mockResolvedValue([createCategory()]);

      const result = await service.categoriesQuery({
        categoryWhereInput: { isActive: true },
      });

      // DTO 필드가 private이라 직렬화 결과로 확인한다
      expect(JSON.parse(JSON.stringify(result))).toEqual([
        { slug: 'hiking', name: '등산', displayOrder: 1 },
      ]);
    });

    it('결과가 없으면 빈 배열을 반환한다', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await expect(
        service.categoriesQuery({ categoryWhereInput: { isActive: true } }),
      ).resolves.toEqual([]);
    });

    it('where 조건을 그대로 넘긴다', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await service.categoriesQuery({
        categoryWhereInput: { slug: { in: ['hiking'] }, isActive: true },
      });

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: { in: ['hiking'] }, isActive: true },
        }),
      );
    });
  });

  describe('getCategories', () => {
    it('displayOrder 오름차순으로 조회한다', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await service.getCategories({ categoryWhereInput: { isActive: true } });

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      });
    });

    it('DTO 변환 없이 엔티티를 그대로 반환한다', async () => {
      const categories = [createCategory()];
      prisma.category.findMany.mockResolvedValue(categories);

      await expect(
        service.getCategories({ categoryWhereInput: {} }),
      ).resolves.toBe(categories);
    });
  });

  describe('getCategory', () => {
    it('unique 조건으로 조회한다', async () => {
      const category = createCategory();
      prisma.category.findUnique.mockResolvedValue(category);

      await expect(service.getCategory({ slug: 'hiking' })).resolves.toBe(
        category,
      );
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'hiking' },
      });
    });

    it('없으면 null을 반환한다', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.getCategory({ slug: 'unknown' }),
      ).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('전달받은 데이터로 카테고리를 생성한다', async () => {
      const data = { slug: 'cafe', name: '카페' };
      const category = createCategory({ id: 11, ...data });
      prisma.category.create.mockResolvedValue(category);

      await expect(service.create(data)).resolves.toBe(category);
      expect(prisma.category.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('delete', () => {
    it('unique 조건으로 삭제한다', async () => {
      const category = createCategory();
      prisma.category.delete.mockResolvedValue(category);

      await expect(service.delete({ id: 10 })).resolves.toBe(category);
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
    });
  });
});
