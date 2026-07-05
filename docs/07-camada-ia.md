# 07 — Camada de IA

> A IA só entra quando o **motor de regras** (`docs/08`) não resolve. Ela detecta intenção,
> extrai entidades e chama os casos de uso via **function calling**. Provedor: **Gemini** (free)
> com **Groq** de fallback — nunca OpenAI (pago), ver `docs/00`.

## Interface (Strategy Pattern)

Todo o domínio fala com uma **porta**, nunca com um SDK específico:

```ts
// domain
export interface LlmProvider {
  complete(input: LlmRequest): Promise<LlmResult>; // suporta tool/function calling
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[]; // memória de contexto (Conversation)
  tools: LlmToolDef[]; // funções expostas (casos de uso)
  temperature?: number; // baixa (0-0.2): tarefa determinística
}

export interface LlmResult {
  text?: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}
```

Adapters em `infrastructure/`:

- `GeminiLlmProvider` → `gemini-2.0-flash` (principal).
- `GroqLlmProvider` → `llama-3.3-70b` (fallback/mensagens simples).
- (futuro) `OpenAiLlmProvider` — só trocar o binding no módulo, **zero** mudança no domínio.

Seleção por config/env (`LLM_PROVIDER=gemini|groq`) + fallback automático se o principal falhar
ou estourar rate limit.

## Function calling = casos de uso

Cada função exposta ao LLM corresponde **1-para-1** a um caso de uso (`docs/10`). O LLM **nunca**
escreve no banco — ele só decide **qual função chamar com quais argumentos**; quem executa é o
`UseCase` (com todas as regras e validações). Funções:

`registrar_receita` · `registrar_despesa` · `guardar_caixinha` · `retirar_caixinha` ·
`pagar_conta` · `criar_meta` · `aportar_meta` · `consultar`.

Exemplo de definição:

```json
{
  "name": "registrar_despesa",
  "description": "Registra uma despesa. NUNCA invente a forma de pagamento.",
  "parameters": {
    "type": "object",
    "properties": {
      "valorCentavos": { "type": "integer" },
      "forma": { "enum": ["DINHEIRO", "SALDO", "CAIXINHA", "CARTAO", "PIX"] },
      "categoria": { "type": "string" }
    },
    "required": ["valorCentavos"]
  }
}
```

## Frase composta (o caso que justifica a IA)

Entrada: _"Hoje trabalhei pra Maria, recebi 220, paguei 35 de gasolina, guardei 50 na reserva e comprei pão no cartão."_

O LLM retorna **múltiplas** tool calls em ordem:

1. `registrar_receita(valor=22000, origem=DIARIA, cliente="Maria")`
2. `registrar_despesa(valor=3500, categoria="combustível")` → **forma faltando** → sistema pergunta.
3. `guardar_caixinha(valor=5000)`
4. `registrar_despesa(valor=?, forma=CARTAO, categoria="alimentação")` → **valor do pão faltando** → pergunta.

O orquestrador executa as completas e **enfileira perguntas** para as incompletas — nunca assume.

## Regras da IA (guard-rails)

- ⚠️ **Nunca assumir valor** ausente — perguntar.
- ⚠️ **Nunca inferir forma de pagamento** — é sempre perguntada (regra do domínio).
- ⚠️ **Confirmar** antes de operações destrutivas/ambíguas.
- ⚠️ **Evitar duplicados** — a mesma checagem anti-duplicação do motor de regras.
- O system prompt injeta a persona ("contador pessoal simpático, linguagem simples") e as regras.
- Validação dupla: os args da tool call passam pelo **mesmo Zod/DTO** do endpoint REST antes de executar.

## Memória de contexto

- `Conversation` + `Message` (Prisma) guardam o histórico por usuário/canal.
- A cada chamada, enviamos as últimas **N mensagens** (janela) + um **resumo** das anteriores
  (gerado por LLM barato ocasionalmente) para não estourar contexto nem custo.
- Estado de diálogo curto (aguardando origem/forma/destino) fica na sessão, resolvido de
  preferência **sem** IA (o motor de regras completa).

## Controle de custo (manter grátis)

1. **Regras primeiro:** só chama LLM em MISS do motor (`docs/08`).
2. **Modelo barato:** `flash`/Groq; `temperature` baixa; `max_tokens` curto.
3. **Janela de contexto pequena** + resumo.
4. **Cache** de respostas de ajuda/menu (fixas, sem IA).
5. **Métrica:** `Message.usedAi` permite medir a % de mensagens que consumiram IA e vigiar o free tier.

## Testes

- Mock do `LlmProvider` (não chama rede nos testes unitários).
- Frase composta → sequência de tool calls esperada.
- Guard-rails: valor ausente ⇒ pergunta, não grava; forma nunca inferida.
- Fallback: se Gemini lança/estoura limite, cai no Groq.
