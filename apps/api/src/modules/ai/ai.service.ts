import { Injectable, Logger } from '@nestjs/common';
import { Action } from '../chat/actions';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { LlmProvider, LlmToolCall, LlmToolDef } from './llm-provider';

const SYSTEM_PROMPT = `Você é o Fin, um contador pessoal simpático de trabalhadores autônomos brasileiros.
Sua tarefa: interpretar a mensagem e chamar as funções corretas, na ordem em que as ações aparecem.

REGRAS INEGOCIÁVEIS:
- NUNCA invente valores. Se o valor não estiver claro, não chame a função (deixe sem chamar).
- NUNCA invente a forma de pagamento de uma despesa. Se não foi dita, chame registrar_despesa SEM o campo "forma".
- NUNCA invente a origem de uma receita. Se não foi dita, chame registrar_receita SEM o campo "origem".
- Valores em CENTAVOS (R$ 220,00 = 22000).
- Uma frase pode conter VÁRIAS ações — chame uma função para cada.
- Se não for sobre finanças, responda com texto curto e simpático, sem chamar funções.`;

const TOOLS: LlmToolDef[] = [
  {
    name: 'registrar_receita',
    description: 'Registra dinheiro que o usuário recebeu/ganhou hoje.',
    parameters: {
      type: 'object',
      properties: {
        valorCentavos: { type: 'integer', description: 'valor em centavos' },
        origem: { type: 'string', enum: ['DIARIA', 'PIX', 'SALARIO', 'VENDA', 'OUTRO'] },
        cliente: { type: 'string', description: 'nome do cliente, se citado' },
        descricao: { type: 'string' },
      },
      required: ['valorCentavos'],
    },
  },
  {
    name: 'registrar_despesa',
    description: 'Registra um gasto/pagamento. NUNCA invente a forma de pagamento.',
    parameters: {
      type: 'object',
      properties: {
        valorCentavos: { type: 'integer' },
        forma: { type: 'string', enum: ['DINHEIRO', 'SALDO', 'CAIXINHA', 'CARTAO', 'PIX'] },
        descricao: { type: 'string', description: 'o que foi pago (ex.: gasolina, pão)' },
      },
      required: ['valorCentavos'],
    },
  },
  {
    name: 'guardar_caixinha',
    description: 'Guarda dinheiro na reserva/caixinha (só quando o usuário manda explicitamente).',
    parameters: {
      type: 'object',
      properties: { valorCentavos: { type: 'integer' } },
      required: ['valorCentavos'],
    },
  },
  {
    name: 'retirar_caixinha',
    description: 'Tira dinheiro da caixinha. Se o destino não foi dito, não preencha "destino".',
    parameters: {
      type: 'object',
      properties: {
        valorCentavos: { type: 'integer' },
        destino: { type: 'string', enum: ['APENAS', 'PAGAR_CONTA'] },
      },
      required: ['valorCentavos'],
    },
  },
  {
    name: 'consultar',
    description: 'Consulta saldo, quanto pode gastar, resumo do mês, contas vencidas, reserva ou economia do ano.',
    parameters: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['saldo', 'posso_gastar', 'mensal', 'vencidas', 'reserva', 'economia'] },
      },
      required: ['tipo'],
    },
  },
];

/**
 * Orquestrador de IA (docs/07): detecta intenção/entidades via function calling
 * e converte tool calls em Actions — quem executa é o ActionExecutor (com todas
 * as regras). Fallback automático Gemini → Groq.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly groq: GroqProvider,
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
  }

  private providers(): LlmProvider[] {
    const order =
      (process.env.LLM_PROVIDER ?? 'gemini') === 'groq'
        ? [this.groq, this.gemini]
        : [this.gemini, this.groq];
    return order.filter((p) =>
      p.name === 'gemini' ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.GROQ_API_KEY),
    );
  }

  async interpret(userId: string, text: string): Promise<{ actions: Action[]; text?: string }> {
    for (const provider of this.providers()) {
      try {
        const result = await provider.complete({
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: text }],
          tools: TOOLS,
          temperature: 0.1,
        });
        return { actions: result.toolCalls.map((tc) => this.toAction(tc)).filter(Boolean) as Action[], text: result.text };
      } catch (e) {
        this.logger.warn(`Provider ${provider.name} falhou: ${(e as Error).message}`);
        // tenta o próximo (fallback — docs/07)
      }
    }
    return { actions: [] };
  }

  /** Tool call → Action. Validação defensiva: args inválidos são descartados. */
  private toAction(tc: LlmToolCall): Action | null {
    const cents = toPositiveInt(tc.args.valorCentavos);
    switch (tc.name) {
      case 'registrar_receita':
        return {
          kind: 'income',
          amountCents: cents,
          source: asEnum(tc.args.origem, ['DIARIA', 'PIX', 'SALARIO', 'VENDA', 'OUTRO'] as const),
          clientName: asString(tc.args.cliente),
          note: asString(tc.args.descricao),
        };
      case 'registrar_despesa':
        return {
          kind: 'expense',
          amountCents: cents,
          method: asEnum(tc.args.forma, ['DINHEIRO', 'SALDO', 'CAIXINHA', 'CARTAO', 'PIX'] as const),
          note: asString(tc.args.descricao),
        };
      case 'guardar_caixinha':
        return { kind: 'reserve_deposit', amountCents: cents };
      case 'retirar_caixinha':
        return {
          kind: 'reserve_withdraw',
          amountCents: cents,
          destination: asEnum(tc.args.destino, ['APENAS', 'PAGAR_CONTA'] as const),
        };
      case 'consultar': {
        const tipo = asEnum(tc.args.tipo, ['saldo', 'posso_gastar', 'mensal', 'vencidas', 'reserva', 'economia'] as const);
        return tipo ? { kind: 'query', type: tipo } : null;
      }
      default:
        return null;
    }
  }
}

function toPositiveInt(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v.toUpperCase())
    ? (v.toUpperCase() as T)
    : typeof v === 'string' && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : undefined;
}
