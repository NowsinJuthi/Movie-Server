import { IsMongoId, IsOptional, ValidateIf } from 'class-validator';

export class SelectPlaybackTracksDto {
  @IsOptional()
  @IsMongoId()
  audioId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId()
  subtitleId?: string | null;
}
