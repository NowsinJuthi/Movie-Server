import { IsBoolean } from 'class-validator';

export class MovieUploadRequestFeatureDto {
  @IsBoolean()
  enabled!: boolean;
}
