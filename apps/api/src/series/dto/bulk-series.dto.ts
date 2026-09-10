import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsMongoId } from 'class-validator';
import { BULK_SERIES_ACTIONS, BulkSeriesAction } from '@movie-server/shared';

export class BulkSeriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsIn([...BULK_SERIES_ACTIONS])
  action!: BulkSeriesAction;
}
