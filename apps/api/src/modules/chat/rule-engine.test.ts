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

  // ── parser NLU: entidades extraídas mesmo SEM valor (feedback do usuário) ──

  it('comprei um lanche no cartão mercado pago → despesa sem valor, com cartão', () => {
    expect(matchRule('Comprei um lanche no cartão mercado pago')).toMatchObject({
      kind: 'expense',
      amountCents: undefined,
      method: 'CARTAO',
      cardName: 'mercado pago',
    });
  });

  it('paguei um pastel no nubank via cartão → captura o nome do cartão', () => {
    expect(matchRule('paguei um pastel no cartão nubank')).toMatchObject({
      kind: 'expense',
      method: 'CARTAO',
      cardName: 'nubank',
    });
  });

  it('gastei 40 no pix → despesa já com forma PIX', () => {
    expect(matchRule('gastei 40 no pix')).toMatchObject({
      kind: 'expense',
      amountCents: 4000,
      method: 'PIX',
    });
  });

  it('paguei 30 em dinheiro → forma DINHEIRO', () => {
    expect(matchRule('paguei 30 em dinheiro')).toMatchObject({
      kind: 'expense',
      amountCents: 3000,
      method: 'DINHEIRO',
    });
  });

  it('recebi um pix → receita sem valor, origem PIX (vai perguntar o valor)', () => {
    expect(matchRule('recebi um pix')).toMatchObject({
      kind: 'income',
      amountCents: undefined,
      source: 'PIX',
    });
  });

  it('ganhei 200 na maria → cliente com preposição "na"', () => {
    expect(matchRule('ganhei 200 na maria')).toMatchObject({
      kind: 'income',
      amountCents: 20000,
      clientName: 'maria',
    });
  });

  it('recebi 300 de diária → origem DIARIA detectada', () => {
    expect(matchRule('recebi 300 de diária')).toMatchObject({
      kind: 'income',
      amountCents: 30000,
      source: 'DIARIA',
    });
  });

  // ── desfazer último lançamento ──

  it.each(['desfazer', 'desfaz isso', 'apagar', 'errei', 'apaga o ultimo'])(
    '"%s" → undo_last',
    (text) => {
      expect(matchRule(text)).toEqual({ kind: 'undo_last' });
    },
  );

  // ── cadastrar cartão ──

  it('cadastrar cartão nubank → new_card com nome', () => {
    expect(matchRule('cadastrar cartão nubank')).toMatchObject({
      kind: 'new_card',
      name: 'nubank',
    });
  });

  it('novo cartão → new_card sem nome', () => {
    expect(matchRule('novo cartão')).toEqual({ kind: 'new_card' });
  });

  // ── gastos fixos em massa ──

  it('lista de contas (várias linhas) → bulk_bills', () => {
    const action = matchRule('Faculdade 700\nInternet 156\nClaro 89\nNetflix 55');
    expect(action).toMatchObject({ kind: 'bulk_bills' });
    const items = (action as { items: { name: string; amountCents: number }[] }).items;
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ name: 'Faculdade', amountCents: 70000 });
    expect(items[3]).toEqual({ name: 'Netflix', amountCents: 5500 });
  });

  it('uma linha só não vira bulk (é comando normal)', () => {
    expect(matchRule('paguei 90 de agua')).toMatchObject({ kind: 'expense' });
  });

  it('linhas sem valor não viram bulk', () => {
    expect(matchRule('oi tudo bem\ncomo vai')).toBeNull();
  });
});
