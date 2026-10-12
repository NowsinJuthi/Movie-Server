import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartScanDto {
  @IsOptional()
  @IsMongoId()
  libraryId?: string;

  /** When true, every file is processed and missing items are marked. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  full?: boolean;

  /** Only scan files whose mtime is within this many hours (ignored when `full` is true). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  recentHours?: number;

  /** Only scan these relative paths (e.g. after Samba upload). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relativePaths?: string[];
}
