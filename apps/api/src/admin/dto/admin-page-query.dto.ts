import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators';

export class QueryProfileSuggestDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class AdminPageQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
