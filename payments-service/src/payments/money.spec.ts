import { decimalNumberTransformer, toCents } from './money';

describe('money utilities', () => {
  it('normalizes monetary values to cents', () => {
    expect(toCents(25.99)).toBe(2599);
    expect(toCents('25.90')).toBe(2590);
    expect(decimalNumberTransformer.to(25.9)).toBe('25.90');
    expect(decimalNumberTransformer.from('25.90')).toBe(25.9);
  });
});
