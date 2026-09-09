import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsDate,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_CATEGORIES_PER_POST = 3;
export class CreateTripPostRequestDto {
  @MaxLength(100)
  @MinLength(1)
  @IsString()
  title!: string;

  @MaxLength(2000)
  @IsString()
  @IsOptional()
  content?: string;

  @MaxLength(100)
  @IsString()
  @IsOptional()
  placeName?: string;

  @Min(2)
  @IsInt()
  capacity!: number;

  @Type(() => Date)
  @IsDate()
  meetAt!: Date;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @ArrayMaxSize(MAX_CATEGORIES_PER_POST)
  @ArrayUnique()
  @ArrayNotEmpty()
  @MaxLength(30, { each: true })
  @IsString({ each: true })
  categorySlugs!: string[];
}
