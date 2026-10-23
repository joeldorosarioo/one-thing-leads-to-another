import { isRecord } from './value-guards';

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;

  return 'Unknown error.';
}
