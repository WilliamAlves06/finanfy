import { describe, expect, it } from 'vitest';
import { matchRule } from './rule-engine';

describe('Motor de regras sem IA (docs/08)', () => {
  it.each([
    ['saldo', { kind: 'query', type: 'saldo' }],
    ['Quanto tenho?', { kind: 'query', type: 'saldo' }],
    ['quanto posso gastar', { kind: 'query', type: 'posso_gastar' }],
    ['relatório', { kind: 'query', type: 'mensal' }],
    ['quanto gastei', { kind: 'query', type: 'mensal' }],
    ['quanto economizei este ano', { kind: 'query', type: 'economia' }],
    ['quanto tem na caixinha', { kind: 'query', type: 'reserva' }],
  ])('"%s" → consulta', (text, expected) => {
    expect(matchRule(text)).toEqual(expected);
  });

  it('ganhei 180 → receita SEM origem (vai perguntar — UC-01)', () => {
    const action = matchRule('ganhei 180');
    expect(action).toMatchObject({ kind: 'income', amountCents: 18000 });
    expect((action as { source?: string }).source).toBeUndefined();
  });

  it('recebi um pix de 200 → receita com origem PIX', () => {
    expect(matchRule('recebi um pix de 200')).toMatchObject({
      kind: 'income',
      amountCents: 20000,
      source: 'PIX',
    });
  });

  it('ganhei 150 da Maria → captura o cliente', () => {
    expect(matchRule('ganhei 150 da maria')).toMatchObject({
      kind: 'income',
      amountCents: 15000,
      clientName: 'maria',
    });
  });

  it('paguei água 90 → despesa SEM forma (vai perguntar — UC-02)', () => {
    const action = matchRule('Paguei água 90');
    expect(action).toMatchObject({ kind: 'expense', amountCents: 9000 });
    expect((action as { method?: string }).method).toBeUndefined();
    expect((action as { note?: string }).note).toContain('agua');
  });

  it('guardei 300 → depósito na caixinha', () => {
    expect(matchRule('guardei 300')).toMatchObject({
      kind: 'reserve_deposit',
      amountCents: 30000,
    });
  });

  it('coloquei 50 na reserva → depósito', () => {
    expect(matchRule('coloquei 50 na reserva')).toMatchObject({
      kind: 'reserve_deposit',
      amountCents: 5000,
    });
  });

  it('tirei 100 da caixinha → retirada SEM destino (vai perguntar — UC-04)', () => {
    const action = matchRule('tirei 100 da caixinha');
    expect(action).toMatchObject({ kind: 'reserve_withdraw', amountCents: 10000 });
    expect((action as { destination?: string }).destination).toBeUndefined();
  });

  it('valores com formato brasileiro', () => {
    expect(matchRule('gastei R$ 90,50 no mercado')).toMatchObject({
      kind: 'expense',
      amountCents: 9050,
    });
  });

  it('ajuda/oi → help', () => {
    expect(matchRule('oi')).toEqual({ kind: 'help' });
    expect(matchRule('ajuda')).toEqual({ kind: 'help' });
  });

  it('frase composta → MISS (vai para a IA — docs/07)', () => {
    expect(
      matchRule('hoje trabalhei pra maria, recebi 220, paguei 35 de gasolina e guardei 50'),
    ).toBeNull();
  });

  it('mensagem sem sentido financeiro → MISS', () => {
    expect(matchRule('qual a previsão do tempo?')).toBeNull();
  });
});
