import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationsController } from './participations.controller';

describe('ParticipationsController', () => {
  let controller: ParticipationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipationsController],
    }).compile();

    controller = module.get<ParticipationsController>(ParticipationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
