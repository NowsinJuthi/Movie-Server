import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly dummyHash: string;

  constructor(private readonly config: ConfigService) {
    this.dummyHash = bcrypt.hashSync('__timing_safe_dummy__', 10);
  }

  rounds(): number {
    return this.config.getOrThrow<number>('BCRYPT_ROUNDS');
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds());
  }

  compare(plain: string, hash?: string): Promise<boolean> {
    return bcrypt.compare(plain, hash ?? this.dummyHash);
  }
}
