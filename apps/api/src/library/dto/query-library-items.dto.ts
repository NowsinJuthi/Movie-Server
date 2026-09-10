import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LIBRARY_ITEM_STATUSES, LIBRARY_MATCH_TYPES, LibraryItemStatus, LibraryMatchType } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

export class QueryLibraryItemsDto {
  @IsOptional()
  @IsIn([...LIBRARY_ITEM_STATUSES])
  status?: LibraryItemStatus;

  @IsOptional()
  @IsIn([...LIBRARY_MATCH_TYPES])
  match?: LibraryMatchType;

  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
