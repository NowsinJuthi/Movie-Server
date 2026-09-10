import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { stripMongoOperators } from '../security/sanitize';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body' || metadata.type === 'query') {
      return stripMongoOperators(value);
    }
    return value;
  }
}
