import { Test, TestingModule } from '@nestjs/testing';
import { TripPostService } from './trip-post.service';

describe('TripPostService', () => {
  let service: TripPostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripPostService],
    }).compile();

    service = module.get<TripPostService>(TripPostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
