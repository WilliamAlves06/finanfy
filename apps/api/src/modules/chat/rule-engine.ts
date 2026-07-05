import { Action } from './actions';
import { normalizeText, parseBRLToCents } from './normalize';

/**
 * Motor de regras SEM IA (docs/08) — Chain of Responsibility.
 * Resolve as mensagens simples (~80-90%) sem custo de LLM.
 * Retorna null em MISS → o router chama a IA.
 */
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

  // 1. saldo / quanto tenho
  if (/^(saldo|quanto (eu )?tenho( hoje)?)$/.test(text)) return { kind: 'query', type: 'saldo' };

  // relatórios rápidos
  if (/^(quanto )?posso gastar/.test(text)) return { kind: 'query', type: 'posso_gastar' };
  if (/(relatorio|quanto (gastei|recebi|sobrou))/.test(text)) return { kind: 'query', type: 'mensal' };
  if (/(contas? (vencida|atrasada)|o que (ta|esta) vencido)/.test(text))
    return { kind: 'query', type: 'vencidas' };
  if (/(quanto.*(reserva|caixinha)|(reserva|caixinha)$)/.test(text) && !cents)
    return { kind: 'query', type: 'reserva' };
  if (/quanto economizei/.test(text)) return { kind: 'query', type: 'economia' };

  // 2. retirar da caixinha (antes de despesa: "tirei" não é "paguei")
  if (/\b(tirei|retirei|saquei)\b/.test(text) && /(caixinha|reserva)/.test(text) && cents) {
    return { kind: 'reserve_withdraw', amountCents: cents };
  }

  // 3. guardar na caixinha
  if (
    cents &&
    (/\b(guardei|guardar|coloquei|botei)\b/.test(text) && /(caixinha|reserva)/.test(text) ||
      /^caixinha\s/.test(text) ||
      /^guardei\b/.test(text))
  ) {
    return { kind: 'reserve_deposit', amountCents: cents };
  }

  // 4. despesa: paguei/gastei/comprei
  if (/\b(paguei|gastei|comprei)\b/.test(text) && cents) {
    const note = text
      .replace(/\b(paguei|gastei|comprei)\b/g, '')
      .replace(/r?\$?\s*[\d.,]+/g, '')
      .replace(/\b(reais?|de|no|na|em|com)\b/g, '')
      .trim();
    return { kind: 'expense', amountCents: cents, note: note || undefined };
  }

  // 5. receita: ganhei/recebi
  if (/\b(ganhei|recebi)\b/.test(text)) {
    if (/\bpix\b/.test(text) && cents) {
      return { kind: 'income', amountCents: cents, source: 'PIX' };
    }
    if (cents) {
      // origem NÃO informada → executor vai perguntar (UC-01)
      const clientMatch = text.match(/\b(?:da|do|de)\s+([a-z]{3,})\s*$/);
      return { kind: 'income', amountCents: cents, clientName: clientMatch?.[1] };
    }
  }

  // 6. ajuda
  if (/^(ajuda|oi|ola|menu|comecar|start|\/start|\?)$/.test(text)) return { kind: 'help' };

  return null; // MISS → IA
}
