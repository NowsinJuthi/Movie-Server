import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';

export class StartScanDto {
  @IsOptional()
  @IsMongoId()
  libraryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  full?: boolean;
}
