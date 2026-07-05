# 06 — Camada de Canais

> Vários canais entram no **mesmo núcleo**. No MVP: **Telegram** (grátis) e **Web Chat** (nosso).
> WhatsApp/App/API entram depois **sem tocar no domínio** — só um novo adapter. Ver `docs/00`.

## Interface (Strategy Pattern)

```ts
// domain
export interface MessagingChannel {
  readonly provider: ChannelProvider; // TELEGRAM | WEB | WHATSAPP | ANDROID | API
  send(message: OutgoingMessage): Promise<void>;
}

export interface IncomingMessage {
  provider: ChannelProvider;
  externalId: string; // id do chat/usuário no canal (ex.: chat_id Telegram)
  text: string;
  raw?: unknown; // payload original, p/ debug
}

export interface OutgoingMessage {
  externalId: string;
  text: string;
  quickReplies?: string[]; // ex.: ["Dinheiro","PIX","Cartão"] para perguntar a forma
}
```

Cada canal implementa: (1) **entrada** — receber webhook/HTTP e normalizar para `IncomingMessage`;
(2) **saída** — `send()` que fala a língua do canal.

## Fluxo de entrada

```
Webhook do canal  →  ChannelAdapter.parse()  →  IncomingMessage
      →  MessageRouter.handle(IncomingMessage)
            1. resolveTenant(provider, externalId)  → userId  (ChannelIdentity)
            2. getOrCreateConversation(userId, provider)
            3. RuleEngine.match(text)   (docs/08)
                 hit  → UseCase → Reply
                 miss → AiLayer (docs/07) → UseCase(s) → Reply
            4. persist Message (role, intent, usedAi)
            5. channel.send(OutgoingMessage)   ← mesma resposta, formatada pro canal
```

## Resolução de tenant (multi-tenant)

- `ChannelIdentity (provider, externalId)` → `userId`. Unique garante 1 dono por identidade.
- **Primeiro contato** num canal não vinculado: fluxo de **vínculo** — o usuário informa um código
  gerado no painel web (ou faz login), e criamos a `ChannelIdentity`. Sem vínculo, o bot não opera
  (evita vazamento entre tenants).
- Toda ação subsequente já carrega `userId`; o repositório base isola os dados.

## Adapters do MVP

### Web Chat (nosso)

- Front em `apps/web` (componente de chat) → `POST /v1/chat/messages` no NestJS.
- `provider = WEB`, `externalId = userId` (já autenticado por JWT). Não precisa de vínculo.
- `send()` responde no próprio HTTP (síncrono) ou via SSE/websocket para streaming (opcional).

### Telegram

- Bot criado no **@BotFather** (grátis). Webhook aponta para `POST /v1/channels/telegram/webhook`.
- `parse()` extrai `chat.id` (→ `externalId`) e `text`.
- `send()` chama `sendMessage` da Bot API; `quickReplies` viram **reply keyboard** (botões).
- 100% grátis e ilimitado.

## Como plugar canais futuros (sem mexer no núcleo)

| Canal                  | O que muda                                                           | Custo                     |
| ---------------------- | -------------------------------------------------------------------- | ------------------------- |
| **WhatsApp** (fase 2)  | novo `WhatsAppChannel` via **Evolution API** self-host (não-oficial) | grátis, risco de bloqueio |
| **WhatsApp** (oficial) | mesmo adapter apontando p/ Cloud API                                 | pago                      |
| **App Android/iOS**    | consome a REST `/v1` com JWT; `provider = ANDROID`                   | grátis                    |
| **API pública**        | expõe `/v1` com API keys por tenant; `provider = API`                | grátis                    |

Em todos os casos: **implementa `MessagingChannel`, registra no módulo, pronto.** Router, regras,
IA e domínio não mudam.

## `quickReplies` = zero fricção

Para respeitar "nunca preencher formulário", perguntas do domínio viram **botões**:

- Forma de pagamento → `[Dinheiro] [PIX] [Cartão] [Saldo] [Caixinha]`.
- Origem da receita → `[Diária] [PIX] [Salário] [Venda] [Outro]`.
- Destino da retirada → `[Só retirar] [Pagar conta]`.

No Web viram botões na UI; no Telegram, reply keyboard. O usuário toca em vez de digitar.

## Testes

- `parse()` de cada canal → `IncomingMessage` correto a partir de payload real de exemplo.
- Router: mensagem de canal não vinculado exige vínculo (não executa ação).
- Isolamento: dois `externalId` diferentes nunca compartilham dados.
- `send()` mockado (não chama rede) nos testes unitários.
