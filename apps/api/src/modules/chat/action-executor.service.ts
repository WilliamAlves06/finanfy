import { Injectable } from '@nestjs/common';
import { formatCents } from '../../common/utils/dates';
import { ClientsService } from '../clients/clients.service';
import { ExpensesService } from '../expenses/expenses.service';
import { IncomesService } from '../incomes/incomes.service';
import { ReportsService } from '../reports/reports.service';
import { ReserveService } from '../reserve/reserve.service';
import { Action, Channel, PendingState, Reply } from './actions';

/**
 * Executa ações do assistente. Regras e IA convergem aqui — o LLM NUNCA
 * escreve no banco direto (docs/07). Dado obrigatório faltando → devolve
 * pergunta + estado pendente (nunca assume — docs/01).
 */
@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly incomes: IncomesService,
    private readonly expenses: ExpensesService,
    private readonly reserve: ReserveService,
    private readonly reports: ReportsService,
    private readonly clients: ClientsService,
  ) {}

  async execute(
    userId: string,
    action: Action,
    channel: Channel,
  ): Promise<{ reply: Reply; pending?: PendingState }> {
    switch (action.kind) {
      case 'income': {
        if (!action.amountCents)
          return { reply: { text: 'Quanto você recebeu?', intent: 'income.ask_amount' } };
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
            text: `Receita de ${formatCents(action.amountCents)} registrada! 🎉\nSeu saldo agora é ${res.balanceFormatted}.`,
            intent: 'income.created',
          },
        };
      }

      case 'expense': {
        if (!action.amountCents)
          return { reply: { text: 'Quanto você pagou?', intent: 'expense.ask_amount' } };
        if (!action.method) {
          // ⚠️ regra inegociável: forma de pagamento sempre perguntada (UC-02)
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
        const res = await this.expenses.create(userId, {
          amountCents: action.amountCents,
          method: action.method,
          note: action.note,
          channel,
        });
        const extra =
          action.method === 'CAIXINHA'
            ? (await this.reserve.getBalance(userId)).balanceFormatted
            : res.balanceFormatted;
        return {
          reply: {
            text: `Despesa de ${formatCents(action.amountCents)} registrada (${action.method.toLowerCase()}). ✅\n${
              action.method === 'CAIXINHA'
                ? `Caixinha agora: ${extra}.`
                : `Saldo disponível: ${extra}.`
            }`,
            intent: 'expense.created',
          },
        };
      }

      case 'reserve_deposit': {
        if (!action.amountCents)
          return { reply: { text: 'Quanto você quer guardar?', intent: 'reserve.ask_amount' } };
        const res = await this.reserve.deposit(userId, action.amountCents, channel);
        return {
          reply: {
            text: `Guardado! 💙 Sua caixinha agora tem ${res.balanceFormatted}.`,
            intent: 'reserve.deposited',
          },
        };
      }

      case 'reserve_withdraw': {
        if (!action.amountCents)
          return {
            reply: { text: 'Quanto você quer tirar da caixinha?', intent: 'reserve.ask_amount' },
          };
        if (!action.destination) {
          // ⚠️ regra: sempre perguntar o destino (UC-04)
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

      case 'help':
        return {
          reply: {
            text: [
              'Oi! Eu sou o Fin, seu assistente financeiro. 🙂',
              'Você pode me dizer coisas como:',
              '• "ganhei 180" — registro sua receita',
              '• "paguei água 90" — registro a despesa',
              '• "guardei 50 na caixinha" — sua reserva',
              '• "saldo" ou "quanto posso gastar?" — te conto na hora',
            ].join('\n'),
            intent: 'help',
          },
        };
    }
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
