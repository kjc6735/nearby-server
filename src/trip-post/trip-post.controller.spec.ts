import { Test, TestingModule } from '@nestjs/testing';
import { TripPostController } from './trip-post.controller';

describe('TripPostController', () => {
  let controller: TripPostController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripPostController],
    }).compile();

    controller = module.get<TripPostController>(TripPostController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
