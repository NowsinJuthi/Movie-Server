import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Trim } from '../../common/decorators/transform.decorators';

export class CastMemberDto {
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Trim()
  @Transform(({ value }) =>
    value === '' || value == null
      ? null
      : typeof value === 'string'
        ? sanitizePlainText(value)
        : value,
  )
  @IsString()
  @MaxLength(80)
  character?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  order?: number;

  @IsOptional()
  @Trim()
  @Transform(({ value }) =>
    value === '' || value == null
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}
