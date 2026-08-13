import { ValueTransformer } from 'typeorm';

const MAX_CENTS = 9_999_999_999;

export function toCents(value: number | string): number {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      throw new Error('Invalid monetary value');
    }

    const [units, decimals = ''] = normalized.split('.');
    const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
      throw new Error('Invalid monetary value');
    }
    return cents;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid monetary value');
  }

  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
    throw new Error('Invalid monetary value');
  }
  return cents;
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    throw new Error('Invalid monetary value');
  }
  return cents / 100;
}

export const decimalNumberTransformer: ValueTransformer = {
  to: (value: number): string => fromCents(toCents(value)).toFixed(2),
  from: (value: string | number): number => fromCents(toCents(value)),
};
