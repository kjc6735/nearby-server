import { TripPostWhereUniqueInput } from '../../generated/prisma/models';

type TripPostWritableFields = {
  title: string;
  content: string | null;
  placeName: string | null;
  capacity: number;
  meetAt: Date;
  lat: number;
  lng: number;
};

export type CreateTripPostInput = TripPostWritableFields & {
  authorId: number;
  categoryIds: number[];
};

export type UpdateTripPostInput = TripPostWritableFields & {
  where: TripPostWhereUniqueInput;
  categoryIds: number[];
};
