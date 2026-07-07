import { Injectable } from '@nestjs/common';
import { formatCents } from '../../common/utils/dates';
import { CardsService } from '../cards/cards.service';
import { ClientsService } from '../clients/clients.service';
import { ExpensesService } from '../expenses/expenses.service';
import { IncomesService } from '../incomes/incomes.service';
import { RecurringService } from '../recurring/recurring.service';
import { ReportsService } from '../reports/reports.service';
import { ReserveService } from '../reserve/reserve.service';
import { Action, Channel, PendingState, Reply } from './actions';

/**
 * Executa ações do assistente (parser e IA convergem aqui — o LLM nunca
 * escreve no banco). Dado obrigatório faltando → pergunta + estado FSM.
 * Regra de ouro: nunca assumir valor, forma ou destino (docs/01).
 */
@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly incomes: IncomesService,
    private readonly expenses: ExpensesService,
    private readonly reserve: ReserveService,
    private readonly reports: ReportsService,
    private readonly clients: ClientsService,
    private readonly cards: CardsService,
    private readonly recurring: RecurringService,
  ) {}

  async execute(
    userId: string,
    action: Action,
    channel: Channel,
  ): Promise<{ reply: Reply; pending?: PendingState | null }> {
    switch (action.kind) {
      case 'income':
        return this.executeIncome(userId, action, channel);
      case 'expense':
        return this.executeExpense(userId, action, channel);
      case 'reserve_deposit': {
        if (!action.amountCents) {
          return {
            reply: { text: 'Quanto você quer guardar?', intent: 'reserve.ask_amount' },
            pending: { type: 'AWAITING_AMOUNT', draft: action },
          };
        }
        const res = await this.reserve.deposit(userId, action.amountCents, channel);
        return {
          reply: {
            text: `Guardado! 💙 Sua caixinha agora tem ${res.balanceFormatted}.`,
            intent: 'reserve.deposited',
          },
        };
      }
      case 'reserve_withdraw': {
        if (!action.amountCents) {
          return {
            reply: { text: 'Quanto você quer tirar da caixinha?', intent: 'reserve.ask_amount' },
            pending: { type: 'AWAITING_AMOUNT', draft: action },
          };
        }
        if (!action.destination) {
          return {
            reply: {
              text: `Tirar ${formatCents(action.amountCents)} da caixinha — para onde vai esse dinheiro?`,
              quickReplies: ['Só retirar', 'Pagar uma conta'],
              intent: 'reserve.ask_destination',
            },
            pending: { type: 'AWAITING_WITHDRAW_DESTINATION', amountCents: action.amountCents },
          };
        }
        const res = await this.reserve.withdraw(
          userId,
          action.amountCents,
          action.destination,
          channel,
        );
        return {
          reply: {
            text: `Feito! Sua caixinha agora tem ${res.balanceFormatted}.`,
            intent: 'reserve.withdrawn',
          },
        };
      }
      case 'query':
        return { reply: await this.runQuery(userId, action.type) };
      case 'undo_last':
        return this.askUndoLast(userId);
      case 'bulk_bills': {
        const created: string[] = [];
        for (const item of action.items) {
          await this.recurring.createBill(userId, {
            name: item.name,
            amountCents: item.amountCents,
            dueDay: 10, // padrão; ajustável no painel
          });
          created.push(`• ${item.name}: ${formatCents(item.amountCents)}`);
        }
        const total = action.items.reduce((s, i) => s + i.amountCents, 0);
        return {
          reply: {
            text: `Prontinho! Cadastrei ${created.length} contas fixas: 📋\n${created.join('\n')}\n\nTotal por mês: ${formatCents(total)}. (Vencimento no dia 10 — dá pra ajustar no painel.)`,
            intent: 'bulk_bills.created',
          },
        };
      }
      case 'new_card': {
        if (action.name) {
          return {
            reply: {
              text: `Vamos cadastrar o cartão "${action.name}"! 💳\nQual o limite dele? (ex.: 1000)`,
              intent: 'card.wizard.limit',
            },
            pending: { type: 'NEW_CARD', step: 'LIMIT', draft: { name: action.name } },
          };
        }
        return {
          reply: {
            text: 'Vamos cadastrar um cartão! 💳\nQual o nome dele? (ex.: Nubank)',
            intent: 'card.wizard.name',
          },
          pending: { type: 'NEW_CARD', step: 'NAME', draft: {} },
        };
      }
      case 'help':
        return {
          reply: {
            text: [
              'Oi! Eu sou o Fin, seu assistente financeiro. 🙂',
              'Você pode me dizer coisas como:',
              '• "ganhei 180" — registro sua receita',
              '• "paguei água 90" — registro a despesa',
              '• "comprei um lanche no cartão nubank" — eu pergunto só o valor',
              '• "guardei 50 na caixinha" — sua reserva',
              '• "saldo" ou "quanto posso gastar?" — te conto na hora',
            ].join('\n'),
            intent: 'help',
          },
        };
    }
  }

  private async executeIncome(
    userId: string,
    action: Extract<Action, { kind: 'income' }>,
    channel: Channel,
  ): Promise<{ reply: Reply; pending?: PendingState | null }> {
    if (!action.amountCents) {
      return {
        reply: {
          text: `Quanto você recebeu${action.clientName ? ` de ${action.clientName}` : ''}?`,
          intent: 'income.ask_amount',
        },
        pending: { type: 'AWAITING_AMOUNT', draft: action },
      };
    }
    if (!action.source) {
      return {
        reply: {
          text: `Anotado ${formatCents(action.amountCents)}! De onde veio esse dinheiro?`,
          quickReplies: ['Diária', 'PIX', 'Salário', 'Venda', 'Outro'],
          intent: 'income.ask_source',
        },
        pending: {
          type: 'AWAITING_INCOME_SOURCE',
          amountCents: action.amountCents,
          clientName: action.clientName,
          note: action.note,
        },
      };
    }
    const client = action.clientName
      ? await this.clients.findByName(userId, action.clientName)
      : null;
    const res = await this.incomes.create(userId, {
      amountCents: action.amountCents,
      source: action.source,
      clientId: client?.id,
      note: action.note,
      channel,
    });
    return {
      reply: {
        text: `Boa! Anotei ${formatCents(action.amountCents)} que você recebeu. 🎉\nSeu saldo agora é ${res.balanceFormatted}.`,
        intent: 'income.created',
      },
    };
  }

  private async executeExpense(
    userId: string,
    action: Extract<Action, { kind: 'expense' }>,
    channel: Channel,
  ): Promise<{ reply: Reply; pending?: PendingState | null }> {
    // 1. falta o valor? pergunta só o valor (mantém tudo que já sabemos)
    if (!action.amountCents) {
      return {
        reply: {
          text: `Quanto foi${action.note ? ` (${action.note})` : ''}?`,
          intent: 'expense.ask_amount',
        },
        pending: { type: 'AWAITING_AMOUNT', draft: action },
      };
    }

    // 2. falta a forma? pergunta (regra inegociável — UC-02)
    if (!action.method) {
      return {
        reply: {
          text: `Ok, ${formatCents(action.amountCents)}${action.note ? ` (${action.note})` : ''}. Como foi pago?`,
          quickReplies: ['Dinheiro', 'PIX', 'Saldo', 'Caixinha', 'Cartão'],
          intent: 'expense.ask_method',
        },
        pending: {
          type: 'AWAITING_EXPENSE_METHOD',
          amountCents: action.amountCents,
          note: action.note,
        },
      };
    }

    // 3. cartão: resolve pelo nome; se não achar, teclado com os cartões reais
    let cardId: string | undefined;
    if (action.method === 'CARTAO') {
      const names = await this.cards.listNames(userId);
      const thenExpense = { amountCents: action.amountCents, note: action.note };

      // sem nenhum cartão → cadastra pelo próprio chat e depois conclui a despesa
      if (names.length === 0) {
        if (action.cardName) {
          return {
            reply: {
              text: `Você ainda não tem cartão cadastrado — vamos cadastrar o "${action.cardName}" agora! 💳\nQual o limite dele? (ex.: 1000)`,
              intent: 'card.wizard.limit',
            },
            pending: {
              type: 'NEW_CARD',
              step: 'LIMIT',
              draft: { name: action.cardName },
              thenExpense,
            },
          };
        }
        return {
          reply: {
            text: 'Você ainda não tem cartão cadastrado — vamos cadastrar agora! 💳\nQual o nome do cartão? (ex.: Nubank)',
            intent: 'card.wizard.name',
          },
          pending: { type: 'NEW_CARD', step: 'NAME', draft: {}, thenExpense },
        };
      }

      // sempre perguntar qual cartão quando não foi dito — nunca escolher sozinho
      const card = action.cardName ? await this.cards.findByName(userId, action.cardName) : null;
      if (!card) {
        return {
          reply: {
            text: action.cardName
              ? `Não achei o cartão "${action.cardName}" aqui. Qual desses você usou?`
              : 'Qual cartão você usou?',
            quickReplies: [
              ...names,
              action.cardName ? `Cadastrar "${action.cardName}"` : 'Novo cartão',
            ],
            intent: 'expense.ask_card',
          },
          pending: {
            type: 'AWAITING_CARD',
            amountCents: action.amountCents,
            note: action.note,
            suggestedName: action.cardName,
          },
        };
      }
      cardId = card.id;
    }

    const res = await this.expenses.create(userId, {
      amountCents: action.amountCents,
      method: action.method,
      cardId,
      note: action.note,
      channel,
    });
    const extra =
      action.method === 'CAIXINHA'
        ? `Caixinha agora: ${(await this.reserve.getBalance(userId)).balanceFormatted}.`
        : action.method === 'CARTAO'
          ? 'Vai para a fatura do cartão. 💳'
          : `Saldo disponível: ${res.balanceFormatted}.`;
    return {
      reply: {
        text: `Prontinho! Registrei ${action.note ? `"${action.note}" ` : ''}${formatCents(action.amountCents)} no ${action.method.toLowerCase()}. ✅\n${extra}`,
        intent: 'expense.created',
      },
    };
  }

  /** Acha o último lançamento (receita ou despesa) e pede confirmação p/ apagar. */
  private async askUndoLast(
    userId: string,
  ): Promise<{ reply: Reply; pending?: PendingState | null }> {
    const [lastIncome, lastExpense] = await Promise.all([
      this.incomes.findLast(userId),
      this.expenses.findLast(userId),
    ]);

    if (!lastIncome && !lastExpense) {
      return {
        reply: {
          text: 'Não achei nenhum lançamento recente pra desfazer. 🤔',
          intent: 'undo.empty',
        },
      };
    }

    const incomeNewer =
      lastIncome && (!lastExpense || lastIncome.createdAt > lastExpense.createdAt);
    const target = incomeNewer
      ? { kind: 'income' as const, id: lastIncome!.id }
      : { kind: 'expense' as const, id: lastExpense!.id };
    const desc = incomeNewer
      ? `a receita de ${formatCents(lastIncome!.amountCents)} (${lastIncome!.source.toLowerCase()})`
      : `a despesa de ${formatCents(lastExpense!.amountCents)}${lastExpense!.note ? ` (${lastExpense!.note})` : ''}`;

    return {
      reply: {
        text: `Quer que eu apague ${desc}? Isso não dá pra voltar depois.`,
        quickReplies: ['Sim, apagar', 'Não'],
        intent: 'undo.confirm',
      },
      pending: { type: 'AWAITING_UNDO_CONFIRM', target },
    };
  }

  /** Executa o desfazer confirmado. */
  async confirmUndo(
    userId: string,
    target: { kind: 'income' | 'expense'; id: string },
  ): Promise<Reply> {
    const removed =
      target.kind === 'income'
        ? await this.incomes.remove(userId, target.id)
        : await this.expenses.remove(userId, target.id);
    if (!removed) {
      return { text: 'Esse lançamento não está mais por aqui. 🤷', intent: 'undo.gone' };
    }
    return { text: 'Pronto, apaguei pra você! 🧹 Já ajustei o seu saldo.', intent: 'undo.done' };
  }

  private async runQuery(userId: string, type: string): Promise<Reply> {
    switch (type) {
      case 'saldo': {
        const s = await this.reports.summary(userId);
        return {
          text: `Você tem ${s.balanceFormatted} disponível e ${s.reserveFormatted} na caixinha.${
            s.pendingBillsCount > 0 ? `\n⚠️ ${s.pendingBillsCount} conta(s) pendente(s).` : ''
          }`,
          intent: 'query.saldo',
        };
      }
      case 'posso_gastar': {
        const c = await this.reports.canSpend(userId);
        return {
          text: `Você pode gastar ${c.canSpendFormatted} sem apertar.\n(saldo ${c.explain.saldo} − contas ${c.explain.contasPendentes} − faturas ${c.explain.faturasAbertas})`,
          intent: 'query.posso_gastar',
        };
      }
      case 'mensal': {
        const m = await this.reports.monthly(userId);
        return {
          text: `Este mês: entrou ${m.incomeFormatted}, saiu ${m.expenseFormatted}.\nSobrou ${m.leftFormatted}.`,
          intent: 'query.mensal',
        };
      }
      case 'vencidas': {
        const list = await this.reports.overdue(userId);
        if (list.length === 0)
          return { text: 'Nenhuma conta vencida. 👏', intent: 'query.vencidas' };
        const lines = list.map(
          (c) =>
            `• ${c.recurringBill.name}: ${formatCents(c.amountCents)} (venceu ${c.dueDate.toISOString().slice(0, 10)})`,
        );
        return { text: `Contas vencidas:\n${lines.join('\n')}`, intent: 'query.vencidas' };
      }
      case 'reserva': {
        const r = await this.reserve.getBalance(userId);
        return { text: `Sua caixinha tem ${r.balanceFormatted}.`, intent: 'query.reserva' };
      }
      case 'economia': {
        const s = await this.reports.savings(userId);
        return {
          text: `Em ${s.year} você já economizou ${s.savedFormatted}. 💪`,
          intent: 'query.economia',
        };
      }
      default:
        return { text: 'Não entendi o que você quer consultar.', intent: 'query.unknown' };
    }
  }
}
