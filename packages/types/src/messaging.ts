import type { ChannelProvider } from './enums.js';

/** Mensagem normalizada vinda de qualquer canal (docs/06). */
export interface IncomingMessage {
  provider: ChannelProvider;
  externalId: string;
  text: string;
  raw?: unknown;
}

/** Resposta enviada de volta pelo canal (docs/06). */
export interface OutgoingMessage {
  externalId: string;
  text: string;
  /** Botões de resposta rápida (viram reply keyboard no Telegram). */
  quickReplies?: string[];
}
