import { ValueTransformer } from 'typeorm';

export function toCents(value: number | string): number {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      throw new Error('Invalid monetary value');
    }

    const [units, decimals = ''] = normalized.split('.');
    const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents)) {
      throw new Error('Invalid monetary value');
    }
    return cents;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid monetary value');
  }

  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Invalid monetary value');
  }
  return cents;
}

export const decimalNumberTransformer: ValueTransformer = {
  to: (value: number): string => (toCents(value) / 100).toFixed(2),
  from: (value: string | number): number => toCents(value) / 100,
};
