import { describe, expect, it } from 'vitest';
import { isToday, todayInTz } from './date.js';

describe('todayInTz / isToday', () => {
  // 2026-07-04 23:30 UTC = 2026-07-04 20:30 em São Paulo
  const now = new Date('2026-07-04T23:30:00Z');

  it('retorna o dia no fuso de São Paulo', () => {
    expect(todayInTz('America/Sao_Paulo', now)).toBe('2026-07-04');
  });

  it('meia-noite UTC ainda é o dia anterior em SP', () => {
    const edge = new Date('2026-07-05T01:00:00Z'); // 22:00 do dia 04 em SP
    expect(todayInTz('America/Sao_Paulo', edge)).toBe('2026-07-04');
  });

  it('isToday valida a regra sem-retroativo', () => {
    expect(isToday('2026-07-04', 'America/Sao_Paulo', now)).toBe(true);
    expect(isToday('2026-07-03', 'America/Sao_Paulo', now)).toBe(false);
  });
});
