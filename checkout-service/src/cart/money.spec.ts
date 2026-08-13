import { decimalNumberTransformer, fromCents, toCents } from './money';

describe('money helpers', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    [0.1 + 0.2, 30],
  ])('converts %p to integer cents', (value, expected) => {
    expect(toCents(value)).toBe(expected);
  });

  it.each(['', '-1', '1.234', 'NaN', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid monetary value %p',
    (value) => expect(() => toCents(value)).toThrow('Invalid monetary value'),
  );

  it('converts database decimals to API numbers', () => {
    expect(decimalNumberTransformer.from('19.90')).toBe(19.9);
    expect(decimalNumberTransformer.to(19.9)).toBe('19.90');
    expect(fromCents(1990)).toBe(19.9);
  });
});
