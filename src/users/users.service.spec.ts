import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'user@example.com',
  username: 'tester',
  name: '테스터',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getMyProfile', () => {
    it('사용자 정보를 password 없이 반환한다', async () => {
      prisma.user.findUnique.mockResolvedValue(createUser());

      const result = await service.getMyProfile({ id: 1 });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '테스터',
        username: 'tester',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('사용자가 없으면 NotFoundException을 던진다', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile({ id: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMyProfile', () => {
    it('이름과 유저네임을 수정하고 수정된 정보를 반환한다', async () => {
      prisma.user.findUnique.mockResolvedValue(createUser());
      prisma.user.update.mockResolvedValue(
        createUser({ name: '새이름', username: 'newname' }),
      );

      const result = await service.updateMyProfile({
        unique: { id: 1 },
        userUpdateInput: { name: '새이름', username: 'newname' },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: '새이름', username: 'newname' },
      });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '새이름',
        username: 'newname',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('사용자가 없으면 NotFoundException을 던지고 수정하지 않는다', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMyProfile({
          unique: { id: 999 },
          userUpdateInput: { name: '새이름', username: 'newname' },
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('unique 조건으로 조회한다', async () => {
      const user = createUser();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.findOne({ email: user.email })).resolves.toBe(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
    });

    it('없으면 null을 반환한다', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne({ id: 999 })).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('전달받은 데이터로 사용자를 생성한다', async () => {
      const data = {
        email: 'new@example.com',
        password: 'hashed-password',
        name: '신규',
        username: 'newbie',
      };
      const user = createUser({ id: 2, ...data });
      prisma.user.create.mockResolvedValue(user);

      await expect(service.create(data)).resolves.toBe(user);
      expect(prisma.user.create).toHaveBeenCalledWith({ data });
    });

    it('생성에 실패하면 에러를 그대로 전파한다', async () => {
      prisma.user.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.create({ email: 'new@example.com', password: 'hashed' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('unique 조건과 데이터를 그대로 넘긴다', async () => {
      const user = createUser({ name: '새이름' });
      prisma.user.update.mockResolvedValue(user);

      await expect(service.update({ id: 1 }, { name: '새이름' })).resolves.toBe(
        user,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: '새이름' },
      });
    });
  });
});
