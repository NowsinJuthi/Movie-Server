import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Transform } from 'class-transformer';

export class UpdateAccountDto {
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;
}
