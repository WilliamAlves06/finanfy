// Ações do assistente — vocabulário comum entre motor de regras e IA (docs/07/08).

export type IncomeSource = 'DIARIA' | 'PIX' | 'SALARIO' | 'VENDA' | 'OUTRO';
export type PaymentMethod = 'DINHEIRO' | 'SALDO' | 'CAIXINHA' | 'CARTAO' | 'PIX';
export type Channel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API';

export type Action =
  | { kind: 'income'; amountCents?: number; source?: IncomeSource; clientName?: string; note?: string }
  | { kind: 'expense'; amountCents?: number; method?: PaymentMethod; note?: string }
  | { kind: 'reserve_deposit'; amountCents?: number }
  | { kind: 'reserve_withdraw'; amountCents?: number; destination?: 'APENAS' | 'PAGAR_CONTA' }
  | { kind: 'query'; type: 'saldo' | 'posso_gastar' | 'mensal' | 'vencidas' | 'reserva' | 'economia' }
  | { kind: 'help' };

/** Estado de diálogo pendente — aguardando dado obrigatório (docs/08). */
export type PendingState =
  | { type: 'AWAITING_INCOME_SOURCE'; amountCents: number; clientName?: string; note?: string }
  | { type: 'AWAITING_EXPENSE_METHOD'; amountCents: number; note?: string }
  | { type: 'AWAITING_WITHDRAW_DESTINATION'; amountCents: number };

export interface Reply {
  text: string;
  quickReplies?: string[];
  /** intenção detectada (métrica) */
  intent?: string;
  /** true quando a resposta veio da IA */
  usedAi?: boolean;
}
