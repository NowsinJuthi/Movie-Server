import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { ErrorCode } from '@movie-server/shared';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Invalid id.',
      });
    }
    return value;
  }
}
