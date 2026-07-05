import { describe, expect, it } from 'vitest';
import { normalizeText } from './text.js';

describe('normalizeText', () => {
  it.each([
    ['Paguei Água 90!', 'paguei agua 90'],
    ['  GANHEI   180  ', 'ganhei 180'],
    ['Quanto tenho?', 'quanto tenho'],
    ['relatório', 'relatorio'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});
