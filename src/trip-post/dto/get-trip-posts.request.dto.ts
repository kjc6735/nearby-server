import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const DEFAULT_TRIP_POST_PAGE_SIZE = 20;
export const MAX_TRIP_POST_PAGE_SIZE = 50;
export const DEFAULT_TRIP_POST_RANGE_KM = 5;
export const MAX_TRIP_POST_RANGE_KM = 50;

export class GetTripPostsRequestDto {
  @IsLatitude()
  @Type(() => Number)
  lat!: number;

  @IsLongitude()
  @Type(() => Number)
  lng!: number;

  @Max(MAX_TRIP_POST_RANGE_KM)
  @Min(0.1)
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  range: number = DEFAULT_TRIP_POST_RANGE_KM;

  @Max(MAX_TRIP_POST_PAGE_SIZE)
  @Min(1)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit: number = DEFAULT_TRIP_POST_PAGE_SIZE;

  @Matches(/^\d+(\.\d+)?(e-\d+)?:\d+$/, {
    message: '커서 형식이 올바르지 않습니다.',
  })
  @IsOptional()
  cursor?: string;
}
