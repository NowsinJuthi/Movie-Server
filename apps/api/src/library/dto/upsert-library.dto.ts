import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { LIBRARY_KINDS, LibraryKind, STORAGE_PROVIDER_KINDS, StorageProviderKind } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';
import { sanitizePlainText } from '../../common/security/sanitize';
import { isSafeHttpUrl } from '../../movies/movie.util';

@ValidatorConstraint({ name: 'librarySafeHttpUrl', async: false })
class SafeHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value == null || value === '' || (typeof value === 'string' && isSafeHttpUrl(value));
  }

  defaultMessage(): string {
    return 'URL must be http(s) and must not be a filesystem path.';
  }
}

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class UpsertLibraryDto {
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn([...LIBRARY_KINDS])
  kind!: LibraryKind;

  @IsOptional()
  @IsIn([...STORAGE_PROVIDER_KINDS])
  provider?: StorageProviderKind;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  rootPath!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  imageUrl?: string | null;
}

export class UpdateLibraryDto {
  @IsOptional()
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn([...STORAGE_PROVIDER_KINDS])
  provider?: StorageProviderKind;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  rootPath?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  imageUrl?: string | null;
}
