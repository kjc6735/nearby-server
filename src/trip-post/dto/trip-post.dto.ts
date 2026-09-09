import { CategoryDto } from '../../categories/dto/category.dto';
import { Category, TripPost, User } from '../../generated/prisma/client';
import { TripPostStatus } from '../../generated/prisma/enums';
import { TripPostAuthorDto } from './trip-post-author.dto';

export type TripPostWithRelations = TripPost & {
  author: User;
  categories: { category: Category }[];
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
    private categories: CategoryDto[],
  ) {}

  static from(tripPost: TripPostWithRelations) {
    const categories = CategoryDto.fromMany(
      tripPost.categories.map(({ category }) => category),
    );

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
    );
  }

  static fromMany(tripPosts: TripPostWithRelations[]) {
    return tripPosts.map((tripPost) => TripPostDto.from(tripPost));
  }
}
