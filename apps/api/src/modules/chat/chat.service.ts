import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { Action, Channel, PendingState, Reply } from './actions';
import { ActionExecutorService } from './action-executor.service';
import { normalizeText, parseBRLToCents } from './normalize';
import { matchRule } from './rule-engine';

/**
 * Message Router + FSM (docs/06/08): pendência → parser → IA.
 * O estado da conversa é PERSISTIDO em Conversation.pendingState —
 * sobrevive a restart/deploy e funciona com várias instâncias.
 */
@Injectable()
export class ChatService {
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
      reply = await this.route(conversation.id, userId, text, channel);
    } catch (e) {
      // erro NÃO apaga o estado da conversa — o usuário pode tentar de novo
      const msg =
        e instanceof Error && 'response' in e
          ? String((e as { response?: { message?: string } }).response?.message ?? e.message)
          : 'Ops, algo deu errado. Tenta de novo?';
      reply = { text: msg, intent: 'error' };
    }

    await this.saveMessage(conversation.id, 'ASSISTANT', reply.text, reply.intent, reply.usedAi);
    return reply;
  }

  private async route(
    conversationId: string,
    userId: string,
    text: string,
    channel: Channel,
  ): Promise<Reply> {
    // 1. FSM: há estado pendente? a mensagem é a resposta do que falta
    const pending = await this.loadPending(conversationId);
    if (pending) {
      const action = this.resolvePending(pending, text);
      if (action) return this.runAction(conversationId, userId, action, channel);

      // não era a resposta esperada — o usuário mudou de assunto?
      const newIntent = matchRule(text);
      if (newIntent) return this.runAction(conversationId, userId, newIntent, channel);

      // repete a pergunta (mantém o estado)
      const again = await this.executor.execute(userId, this.pendingToAction(pending), channel);
      return { ...again.reply, text: `Não entendi. ${again.reply.text}` };
    }

    // 2. parser NLU (sem IA)
    const ruleAction = matchRule(text);
    if (ruleAction) return this.runAction(conversationId, userId, ruleAction, channel);

    // 3. IA (frases compostas/complexas) — só para frases com substância:
    // texto curto sem número nem verbo de ação não é comando financeiro (evita
    // a IA "chutar" intenção em mensagens soltas)
    const words = normalizeText(text).split(' ').length;
    const hasSubstance = words >= 3 || /\d/.test(text);
    if (hasSubstance && this.ai?.isConfigured()) {
      const aiResult = await this.ai.interpret(userId, text);
      if (aiResult.actions.length > 0) {
        const parts: string[] = [];
        for (const action of aiResult.actions) {
          const r = await this.runAction(conversationId, userId, action, channel);
          parts.push(r.text);
          if (await this.loadPending(conversationId)) break; // parou numa pergunta
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

  private async runAction(
    conversationId: string,
    userId: string,
    action: Action,
    channel: Channel,
  ): Promise<Reply> {
    const { reply, pending } = await this.executor.execute(userId, action, channel);
    await this.savePending(conversationId, pending ?? null);
    return reply;
  }

  /** FSM: interpreta a resposta curta conforme o estado atual. */
  private resolvePending(pending: PendingState, rawText: string): Action | null {
    const text = normalizeText(rawText);

    switch (pending.type) {
      case 'AWAITING_AMOUNT': {
        const cents = parseBRLToCents(text);
        if (!cents) return null;
        return { ...pending.draft, amountCents: cents } as Action;
      }

      case 'AWAITING_INCOME_SOURCE': {
        const map: Record<string, 'DIARIA' | 'PIX' | 'SALARIO' | 'VENDA' | 'OUTRO'> = {
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
          credito: 'CARTAO',
          pix: 'PIX',
        };
        const method = Object.entries(map).find(([k]) => text.includes(k))?.[1];
        if (!method) return null;
        // se já disse o cartão junto ("cartao nubank"), aproveita
        const cardName = text.replace(/cart[ao]o|credito|no|de/g, '').trim() || undefined;
        return {
          kind: 'expense',
          amountCents: pending.amountCents,
          method,
          cardName: method === 'CARTAO' ? cardName : undefined,
          note: pending.note,
        };
      }

      case 'AWAITING_CARD':
        // qualquer texto aqui É um nome de cartão — nunca vai para a IA
        return {
          kind: 'expense',
          amountCents: pending.amountCents,
          method: 'CARTAO',
          cardName: rawText.trim(),
          note: pending.note,
        };

      case 'AWAITING_WITHDRAW_DESTINATION': {
        if (/(so retirar|apenas|retirei apenas|nada|so tirar)/.test(text))
          return {
            kind: 'reserve_withdraw',
            amountCents: pending.amountCents,
            destination: 'APENAS',
          };
        if (/(conta|pagar)/.test(text))
          return {
            kind: 'reserve_withdraw',
            amountCents: pending.amountCents,
            destination: 'PAGAR_CONTA',
          };
        return null;
      }
    }
  }

  private pendingToAction(pending: PendingState): Action {
    switch (pending.type) {
      case 'AWAITING_AMOUNT':
        return pending.draft;
      case 'AWAITING_INCOME_SOURCE':
        return {
          kind: 'income',
          amountCents: pending.amountCents,
          clientName: pending.clientName,
        };
      case 'AWAITING_EXPENSE_METHOD':
        return { kind: 'expense', amountCents: pending.amountCents, note: pending.note };
      case 'AWAITING_CARD':
        return {
          kind: 'expense',
          amountCents: pending.amountCents,
          method: 'CARTAO',
          note: pending.note,
        };
      case 'AWAITING_WITHDRAW_DESTINATION':
        return { kind: 'reserve_withdraw', amountCents: pending.amountCents };
    }
  }

  // ── persistência da FSM ──

  private async loadPending(conversationId: string): Promise<PendingState | null> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { pendingState: true },
    });
    return (c?.pendingState as PendingState | null) ?? null;
  }

  private savePending(conversationId: string, pending: PendingState | null) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { pendingState: pending === null ? Prisma.DbNull : (pending as Prisma.InputJsonValue) },
    });
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
