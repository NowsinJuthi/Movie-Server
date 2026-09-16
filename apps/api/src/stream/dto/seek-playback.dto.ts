import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SeekPlaybackDto {
  @IsNumber()
  @Min(0)
  seconds!: number;

  @IsOptional()
  @IsString()
  quality?: string;
}
