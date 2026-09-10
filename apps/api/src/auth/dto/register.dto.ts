import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/decorators/transform.decorators';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include upper, lower, and numeric characters.',
  })
  password!: string;
}
