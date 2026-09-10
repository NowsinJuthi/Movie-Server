import { Transform, Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ArtworkSlotDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['poster', 'backdrop'])
  slot?: 'poster' | 'backdrop';
}

export class ArtworkKeyParamDto {
  @IsString()
  @MaxLength(48)
  @Type(() => String)
  key!: string;
}
