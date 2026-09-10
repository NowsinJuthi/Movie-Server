import { ClientSession, Connection } from 'mongoose';

export async function runInTransaction<T>(
  connection: Connection,
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

function isTransactionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('replica set') ||
    message.includes('Transaction numbers are only allowed') ||
    message.includes('not supported')
  );
}
