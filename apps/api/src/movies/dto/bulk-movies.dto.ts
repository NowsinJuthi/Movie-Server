import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
} from 'class-validator';
import { BULK_MOVIE_ACTIONS, BulkMovieAction } from '@movie-server/shared';

export class BulkMoviesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsIn([...BULK_MOVIE_ACTIONS])
  action!: BulkMovieAction;
}
