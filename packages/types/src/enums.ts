// Enums do domínio — espelham prisma/schema.prisma (fonte da verdade do banco).

export const INCOME_SOURCES = ['DIARIA', 'PIX', 'SALARIO', 'VENDA', 'OUTRO'] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const PAYMENT_METHODS = ['DINHEIRO', 'SALDO', 'CAIXINHA', 'CARTAO', 'PIX'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHANNEL_PROVIDERS = ['TELEGRAM', 'WEB', 'WHATSAPP', 'ANDROID', 'API'] as const;
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number];

export const RESERVE_MOVEMENT_TYPES = ['IN', 'OUT'] as const;
export type ReserveMovementType = (typeof RESERVE_MOVEMENT_TYPES)[number];

/** Destino de uma retirada da caixinha — regra do docs/10 UC-04. */
export const WITHDRAW_DESTINATIONS = ['APENAS', 'PAGAR_CONTA'] as const;
export type WithdrawDestination = (typeof WITHDRAW_DESTINATIONS)[number];
