import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/transform.decorators';

export class ResendVerificationDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
