// Ações do assistente — vocabulário comum entre parser NLU, FSM e IA (docs/07/08).

export type IncomeSource = 'DIARIA' | 'PIX' | 'SALARIO' | 'VENDA' | 'OUTRO';
export type PaymentMethod = 'DINHEIRO' | 'SALDO' | 'CAIXINHA' | 'CARTAO' | 'PIX';
export type Channel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API';

export type Action =
  | {
      kind: 'income';
      amountCents?: number;
      source?: IncomeSource;
      clientName?: string;
      note?: string;
    }
  | {
      kind: 'expense';
      amountCents?: number;
      method?: PaymentMethod;
      cardName?: string;
      note?: string;
    }
  | { kind: 'reserve_deposit'; amountCents?: number }
  | { kind: 'reserve_withdraw'; amountCents?: number; destination?: 'APENAS' | 'PAGAR_CONTA' }
  | {
      kind: 'query';
      type: 'saldo' | 'posso_gastar' | 'mensal' | 'vencidas' | 'reserva' | 'economia';
    }
  | { kind: 'new_card'; name?: string }
  | { kind: 'undo_last' }
  | { kind: 'bulk_bills'; items: { name: string; amountCents: number }[] }
  | { kind: 'help' };

/**
 * FSM da conversa (docs/08): estado persistido em Conversation.pendingState.
 * Enquanto há estado, a resposta do usuário é interpretada como o dado que
 * falta — nunca como comando novo (a não ser que case uma intenção clara).
 */
export type PendingState =
  | { type: 'AWAITING_AMOUNT'; draft: Action } // sabe a intenção, falta o valor
  | { type: 'AWAITING_INCOME_SOURCE'; amountCents: number; clientName?: string; note?: string }
  | { type: 'AWAITING_EXPENSE_METHOD'; amountCents: number; note?: string }
  | { type: 'AWAITING_CARD'; amountCents: number; note?: string; suggestedName?: string } // qual cartão?
  | { type: 'AWAITING_WITHDRAW_DESTINATION'; amountCents: number }
  // assistente de cadastro de cartão (pode continuar uma despesa pendente ao final)
  | {
      type: 'NEW_CARD';
      step: 'NAME' | 'LIMIT' | 'CLOSING' | 'DUE';
      draft: { name?: string; limitCents?: number; closingDay?: number };
      thenExpense?: { amountCents: number; note?: string };
    }
  // confirmação antes de apagar o último lançamento
  | { type: 'AWAITING_UNDO_CONFIRM'; target: { kind: 'income' | 'expense'; id: string } };

export interface Reply {
  text: string;
  quickReplies?: string[];
  intent?: string;
  usedAi?: boolean;
}
