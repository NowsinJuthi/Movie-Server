import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/transform.decorators';

export class ForgotPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
