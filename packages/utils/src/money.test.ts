import { describe, expect, it } from 'vitest';
import { formatCents, parseBRLToCents } from './money.js';

describe('parseBRLToCents', () => {
  it.each([
    ['180', 18000],
    ['90,50', 9050],
    ['90.50', 9050],
    ['R$ 90', 9000],
    ['90 reais', 9000],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['paguei agua 90', 9000],
    ['ganhei 180 hoje', 18000],
  ])('converte "%s" → %d centavos', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it('retorna null sem número', () => {
    expect(parseBRLToCents('recebi um pix')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formata pt-BR', () => {
    //   = espaço não separável do Intl
    expect(formatCents(123456).replace(/ /g, ' ')).toBe('R$ 1.234,56');
  });
});
