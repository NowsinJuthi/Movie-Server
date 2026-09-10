export type RedisCacheClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode?: 'EX' | 'PX', time?: number): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
  quit(): Promise<'OK' | string>;
  connect(): Promise<void>;
  status: string;
};
