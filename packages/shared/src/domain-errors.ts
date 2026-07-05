// Erros de domínio — mapeados p/ HTTP no exception filter da api (docs/09).
// O `code` é o contrato público de erro da API (docs/12).

export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Regra UC-01: receita só pode ser lançada no dia de hoje. */
export class RetroactiveIncomeError extends DomainError {
  readonly code = 'RETROACTIVE_NOT_ALLOWED';
  constructor() {
    super('Receitas só podem ser registradas no dia de hoje.');
  }
}

/** Regra UC-02: forma de pagamento é sempre perguntada, nunca inferida. */
export class PaymentMethodRequiredError extends DomainError {
  readonly code = 'PAYMENT_METHOD_REQUIRED';
  constructor() {
    super('Informe a forma de pagamento.');
  }
}

/** Regra UC-01: origem da receita é obrigatória. */
export class IncomeSourceRequiredError extends DomainError {
  readonly code = 'INCOME_SOURCE_REQUIRED';
  constructor() {
    super('Informe de onde veio o dinheiro.');
  }
}

/** Regra UC-04: destino da retirada da caixinha é sempre perguntado. */
export class WithdrawDestinationRequiredError extends DomainError {
  readonly code = 'WITHDRAW_DESTINATION_REQUIRED';
  constructor() {
    super('Informe o destino da retirada.');
  }
}

/** Caixinha sem saldo suficiente. */
export class InsufficientReserveError extends DomainError {
  readonly code = 'INSUFFICIENT_RESERVE';
  constructor() {
    super('A caixinha não tem saldo suficiente.');
  }
}

/** Possível lançamento duplicado (anti-duplicação, docs/08). */
export class DuplicateEntryError extends DomainError {
  readonly code = 'DUPLICATE_ENTRY';
  constructor() {
    super('Esse lançamento parece repetido. Confirme para registrar de novo.');
  }
}
