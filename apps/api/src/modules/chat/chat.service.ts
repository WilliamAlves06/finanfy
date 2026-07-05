import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { Action, Channel, PendingState, Reply } from './actions';
import { ActionExecutorService } from './action-executor.service';
import { normalizeText } from './normalize';
import { matchRule } from './rule-engine';

/**
 * Message Router (docs/06): pendência → regras → IA.
 * Persiste Conversation/Message (memória de contexto + métrica usedAi).
 * Estado pendente em memória (MVP single-instance; migrar p/ Redis depois).
 */
@Injectable()
export class ChatService {
  private readonly pending = new Map<string, PendingState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ActionExecutorService,
    @Optional() private readonly ai?: AiService,
  ) {}

  async handleMessage(userId: string, text: string, channel: Channel): Promise<Reply> {
    const conversation = await this.getOrCreateConversation(userId, channel);
    await this.saveMessage(conversation.id, 'USER', text);

    let reply: Reply;
    try {
      reply = await this.route(userId, text, channel);
    } catch (e) {
      const msg =
        e instanceof Error && 'response' in e
          ? String((e as { response?: { message?: string } }).response?.message ?? e.message)
          : 'Ops, algo deu errado. Tenta de novo?';
      reply = { text: msg, intent: 'error' };
      this.pending.delete(userId);
    }

    await this.saveMessage(conversation.id, 'ASSISTANT', reply.text, reply.intent, reply.usedAi);
    return reply;
  }

  private async route(userId: string, text: string, channel: Channel): Promise<Reply> {
    // 1. diálogo pendente? resposta curta completa a ação sem IA (docs/08)
    const pending = this.pending.get(userId);
    if (pending) {
      const action = this.resolvePending(pending, text);
      if (action) {
        this.pending.delete(userId);
        return this.runAction(userId, action, channel);
      }
      // o usuário mudou de assunto? nova intenção clara cancela a pendência
      const newIntent = matchRule(text);
      if (newIntent) {
        this.pending.delete(userId);
        return this.runAction(userId, newIntent, channel);
      }
      // não entendeu a resposta → repete a pergunta
      const again = await this.executor.execute(userId, this.pendingToAction(pending), channel);
      return { ...again.reply, text: `Não entendi. ${again.reply.text}` };
    }

    // 2. motor de regras (sem IA)
    const ruleAction = matchRule(text);
    if (ruleAction) return this.runAction(userId, ruleAction, channel);

    // 3. IA (frases compostas/complexas)
    if (this.ai?.isConfigured()) {
      const aiResult = await this.ai.interpret(userId, text);
      if (aiResult.actions.length > 0) {
        const parts: string[] = [];
        for (const action of aiResult.actions) {
          const r = await this.runAction(userId, action, channel);
          parts.push(r.text);
          if (this.pending.get(userId)) break; // parou numa pergunta — espera resposta
        }
        return { text: parts.join('\n\n'), usedAi: true, intent: 'ai.multi' };
      }
      if (aiResult.text) return { text: aiResult.text, usedAi: true, intent: 'ai.text' };
    }

    return {
      text: 'Não entendi. 🙈 Você pode dizer, por exemplo: "ganhei 180", "paguei água 90" ou "saldo". Digite "ajuda" para ver tudo que eu sei fazer.',
      intent: 'miss',
    };
  }

  private async runAction(userId: string, action: Action, channel: Channel): Promise<Reply> {
    const { reply, pending } = await this.executor.execute(userId, action, channel);
    if (pending) this.pending.set(userId, pending);
    return reply;
  }

  /** Resposta curta ("pix", "cartão", "só retirar") completa o estado pendente. */
  private resolvePending(pending: PendingState, rawText: string): Action | null {
    const text = normalizeText(rawText);
    switch (pending.type) {
      case 'AWAITING_INCOME_SOURCE': {
        const map: Record<string, Action['kind'] extends never ? never : 'DIARIA' | 'PIX' | 'SALARIO' | 'VENDA' | 'OUTRO'> = {
          diaria: 'DIARIA',
          pix: 'PIX',
          salario: 'SALARIO',
          venda: 'VENDA',
          outro: 'OUTRO',
          outra: 'OUTRO',
        };
        const source = Object.entries(map).find(([k]) => text.includes(k))?.[1];
        if (!source) return null;
        return {
          kind: 'income',
          amountCents: pending.amountCents,
          source,
          clientName: pending.clientName,
          note: pending.note,
        };
      }
      case 'AWAITING_EXPENSE_METHOD': {
        const map: Record<string, 'DINHEIRO' | 'SALDO' | 'CAIXINHA' | 'CARTAO' | 'PIX'> = {
          dinheiro: 'DINHEIRO',
          saldo: 'SALDO',
          caixinha: 'CAIXINHA',
          reserva: 'CAIXINHA',
          cartao: 'CARTAO',
          pix: 'PIX',
        };
        const method = Object.entries(map).find(([k]) => text.includes(k))?.[1];
        if (!method) return null;
        return { kind: 'expense', amountCents: pending.amountCents, method, note: pending.note };
      }
      case 'AWAITING_WITHDRAW_DESTINATION': {
        if (/(so retirar|apenas|retirei apenas|nada)/.test(text))
          return { kind: 'reserve_withdraw', amountCents: pending.amountCents, destination: 'APENAS' };
        if (/(conta|pagar)/.test(text))
          return { kind: 'reserve_withdraw', amountCents: pending.amountCents, destination: 'PAGAR_CONTA' };
        return null;
      }
    }
  }

  private pendingToAction(pending: PendingState): Action {
    switch (pending.type) {
      case 'AWAITING_INCOME_SOURCE':
        return { kind: 'income', amountCents: pending.amountCents, clientName: pending.clientName };
      case 'AWAITING_EXPENSE_METHOD':
        return { kind: 'expense', amountCents: pending.amountCents, note: pending.note };
      case 'AWAITING_WITHDRAW_DESTINATION':
        return { kind: 'reserve_withdraw', amountCents: pending.amountCents };
    }
  }

  private async getOrCreateConversation(userId: string, channel: Channel) {
    const existing = await this.prisma.conversation.findFirst({ where: { userId, channel } });
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { userId, channel } });
  }

  private saveMessage(
    conversationId: string,
    role: 'USER' | 'ASSISTANT',
    content: string,
    intent?: string,
    usedAi?: boolean,
  ) {
    return this.prisma.message.create({
      data: { conversationId, role, content, intent, usedAi: usedAi ?? false },
    });
  }

  /** Histórico recente para a UI/memória da IA. */
  async history(userId: string, channel: Channel, take = 30) {
    const conversation = await this.prisma.conversation.findFirst({ where: { userId, channel } });
    if (!conversation) return [];
    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return messages.reverse();
  }
}
