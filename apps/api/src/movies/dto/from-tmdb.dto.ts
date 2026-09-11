import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class FromTmdbDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  updateArtwork?: boolean;
}
