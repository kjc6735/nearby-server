import { CategoryDto } from '../../categories/dto/category.dto';
import { Category, TripPost, User } from '../../generated/prisma/client';
import { TripPostStatus } from '../../generated/prisma/enums';
import {
  ParticipationDto,
  ParticipationWithUser,
} from '../../participations/dto/participation.dto';
import { TripPostAuthorDto } from './trip-post-author.dto';

export type TripPostDtoSource = TripPost & {
  author: User;
  categories?: { category: Category }[];
  participations?: ParticipationWithUser[];
};

export class TripPostDto {
  constructor(
    private id: number,
    private title: string,
    private content: string | null,
    private placeName: string | null,
    private capacity: number,
    private status: TripPostStatus,
    private author: TripPostAuthorDto,
    private meetAt: Date,
    private lat: number,
    private lng: number,
    private categories?: CategoryDto[],
    private participations?: ParticipationDto[],
  ) {}

  static from(tripPost: TripPostDtoSource) {
    const categories = tripPost.categories
      ? CategoryDto.fromMany(
          tripPost.categories.map(({ category }) => category),
        )
      : undefined;

    const participations = tripPost.participations
      ? ParticipationDto.fromMany(tripPost.participations)
      : undefined;

    return new TripPostDto(
      tripPost.id,
      tripPost.title,
      tripPost.content,
      tripPost.placeName,
      tripPost.capacity,
      tripPost.status,
      TripPostAuthorDto.from(tripPost.author),
      tripPost.meetAt,
      tripPost.lat,
      tripPost.lng,
      categories,
      participations,
    );
  }

  static fromMany(tripPosts: TripPostDtoSource[]) {
    return tripPosts.map((tripPost) => TripPostDto.from(tripPost));
  }
}
