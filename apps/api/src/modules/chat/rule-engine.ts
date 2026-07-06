import { Action, IncomeSource, PaymentMethod } from './actions';
import { normalizeText, parseBRLToCents } from './normalize';

/**
 * Parser NLU sem IA (docs/08): extrai intenção + entidades (valor, forma,
 * cartão, cliente) mesmo quando incompletas. O que faltar, o executor
 * pergunta via FSM. IA só entra em frase composta ou MISS total.
 */

/** Extrai a forma de pagamento citada na frase (nunca assume — só se dita). */
function extractMethod(text: string): { method?: PaymentMethod; cardName?: string } {
  const cardMatch = text.match(/\bcart[ao]o(?:\s+de\s+credito)?\s*([a-z0-9 ]*)/);
  if (cardMatch) {
    const name = (cardMatch[1] ?? '').replace(/\b(no|na|do|da|de|com|meu|minha)\b/g, '').trim();
    return { method: 'CARTAO', cardName: name || undefined };
  }
  if (/\bno\s+credito\b/.test(text)) return { method: 'CARTAO' };
  if (/\bpix\b/.test(text)) return { method: 'PIX' };
  if (/\bdinheiro\b/.test(text)) return { method: 'DINHEIRO' };
  if (/\b(caixinha|reserva)\b/.test(text)) return { method: 'CAIXINHA' };
  if (/\bsaldo\b/.test(text)) return { method: 'SALDO' };
  return {};
}

/** Nome do cliente: "ganhei 200 da/na Maria", "trabalhei pra Maria". */
function extractClient(text: string): string | undefined {
  const m = text.match(/\b(?:da|do|na|no|pra|para\s+a?)\s+([a-z]{3,}(?:\s+[a-z]{3,})?)\s*$/);
  return m?.[1];
}

/** Descrição da despesa: o que sobra tirando verbos, valor e palavras de forma. */
function extractNote(text: string): string | undefined {
  const note = text
    .replace(/\b(paguei|gastei|comprei|um|uma)\b/g, '')
    .replace(/r?\$?\s*[\d.,]+/g, '')
    .replace(/\b(reais?|de|no|na|em|com|do|da)\b/g, '')
    .replace(/\bcart[ao]o(?:\s+de\s+credito)?\s*[a-z0-9 ]*/g, '')
    .replace(/\b(pix|dinheiro|caixinha|reserva|saldo|credito)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return note || undefined;
}

export function matchRule(rawText: string): Action | null {
  const text = normalizeText(rawText);
  const cents = parseBRLToCents(text);

  // frase composta (2+ verbos de ação) → MISS direto: é trabalho para a IA (docs/07)
  const verbGroups = [
    /\b(ganhei|recebi)\b/,
    /\b(paguei|gastei|comprei)\b/,
    /\b(guardei|coloquei|botei)\b/,
    /\b(tirei|retirei|saquei)\b/,
  ];
  if (verbGroups.filter((v) => v.test(text)).length >= 2) return null;

  // 1. consultas rápidas
  if (/^(saldo|quanto (eu )?tenho( hoje)?)$/.test(text)) return { kind: 'query', type: 'saldo' };
  if (/^(quanto )?posso gastar/.test(text)) return { kind: 'query', type: 'posso_gastar' };
  if (/(relatorio|quanto (gastei|recebi|sobrou))/.test(text))
    return { kind: 'query', type: 'mensal' };
  if (/(contas? (vencida|atrasada)|o que (ta|esta) vencido)/.test(text))
    return { kind: 'query', type: 'vencidas' };
  if (/(quanto.*(reserva|caixinha)|^(reserva|caixinha)$)/.test(text) && !cents)
    return { kind: 'query', type: 'reserva' };
  if (/quanto economizei/.test(text)) return { kind: 'query', type: 'economia' };

  // 2. retirar da caixinha (antes de despesa)
  if (/\b(tirei|retirei|saquei)\b/.test(text) && /(caixinha|reserva)/.test(text)) {
    return { kind: 'reserve_withdraw', amountCents: cents ?? undefined };
  }

  // 3. guardar na caixinha
  if (
    (/\b(guardei|guardar|coloquei|botei)\b/.test(text) && /(caixinha|reserva)/.test(text)) ||
    (cents && (/^caixinha\s/.test(text) || /^guardei\b/.test(text)))
  ) {
    return { kind: 'reserve_deposit', amountCents: cents ?? undefined };
  }

  // 4. despesa — mesmo SEM valor ("comprei um lanche no cartao mercado pago")
  if (/\b(paguei|gastei|comprei)\b/.test(text)) {
    const { method, cardName } = extractMethod(text);
    return {
      kind: 'expense',
      amountCents: cents ?? undefined,
      method,
      cardName,
      note: extractNote(text),
    };
  }

  // 5. receita — mesmo SEM valor ("recebi um pix")
  if (/\b(ganhei|recebi)\b/.test(text)) {
    const source: IncomeSource | undefined = /\bpix\b/.test(text)
      ? 'PIX'
      : /\bdiaria\b/.test(text)
        ? 'DIARIA'
        : /\bsalario\b/.test(text)
          ? 'SALARIO'
          : /\bvenda\b/.test(text)
            ? 'VENDA'
            : undefined;
    return {
      kind: 'income',
      amountCents: cents ?? undefined,
      source,
      clientName: extractClient(text),
    };
  }

  // 6. ajuda
  if (/^(ajuda|oi|ola|menu|comecar|start|\/start|\?)$/.test(text)) return { kind: 'help' };

  return null; // MISS → IA
}
