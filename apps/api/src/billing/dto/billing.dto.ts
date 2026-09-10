import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators';

export class CreateCheckoutDto {
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  kind?: 'checkout' | 'renewal';
}

export class VerifyCheckoutDto {
  @Trim()
  @IsString()
  @MinLength(4)
  sessionId!: string;
}

export class AdminRefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents?: number;

  @IsOptional()
  @Trim()
  @IsString()
  reason?: string;
}
