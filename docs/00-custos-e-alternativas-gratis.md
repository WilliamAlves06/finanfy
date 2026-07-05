# 00 — Custos e Alternativas 100% Gratuitas

> **Regra do projeto:** tudo deve rodar sem custo. Este documento mapeia cada peça da stack,
> marca o que é pago e propõe a alternativa gratuita adotada. **Leia isto antes de arquitetura.**

## Resumo executivo

A stack original tem **2 pontos realmente pagos** que impedem o "100% grátis":

1. **OpenAI** (a IA) — cobra por token. **Trocamos por Google Gemini (free tier) + Groq.**
2. **WhatsApp Business API oficial** — cobra por conversa e exige empresa verificada.
   **No MVP usamos Telegram (100% grátis) e um web chat. WhatsApp fica para depois.**

O resto da stack (Next.js, NestJS, Prisma, Postgres, Redis, etc.) tem plano gratuito viável.

---

## Tabela de decisão

| Camada | Stack pedida | Custo real | Decisão gratuita adotada |
|---|---|---|---|
| Frontend host | Vercel | ✅ Free (hobby) | **Vercel Hobby** — ok para MVP (uso pessoal/não comercial). Alternativa: Cloudflare Pages. |
| API/Workers host | (não definido) | — | **Render Free** ou **Railway trial**; melhor grátis de verdade: **Fly.io free allowance** ou rodar em **Oracle Cloud Always Free** (VM ARM 24GB). |
| Banco Postgres | Supabase | ✅ Free (500MB, 2 projetos) | **Supabase Free**. Alternativa: **Neon Free** (0.5GB, ótimo p/ serverless). |
| Storage | Supabase Storage | ✅ Free (1GB) | **Supabase Storage**. Alternativa: **Cloudflare R2** (10GB grátis). |
| Redis / filas | Redis + BullMQ | ⚠️ Redis gerenciado costuma ser pago | **Upstash Redis Free** (10k cmd/dia) — compatível com BullMQ. Alternativa: Redis no próprio VM. |
| **IA / LLM** | **OpenAI** | ❌ **PAGO** | **Google Gemini 1.5/2.0 Flash** (free tier generoso) como principal + **Groq** (Llama 3.3 grátis, ultrarrápido) como fallback. |
| Canal de msg | WhatsApp oficial | ❌ **PAGO/burocrático** | **Telegram Bot API** (100% grátis, ilimitado) no MVP. WhatsApp via **Evolution API** (self-host, não-oficial) como fase 2 experimental. |
| Auth | JWT próprio | ✅ Grátis | Mantido (jsonwebtoken + bcrypt). |
| Monitoramento | Sentry | ✅ Free (5k eventos/mês) | **Sentry Free**. Logs: **pino** (grátis, self-host). |
| CI/CD | GitHub Actions | ✅ Free (2000 min/mês repo público ilimitado) | Mantido. |
| Cron/agendador | (18h notificações) | — | **GitHub Actions schedule** ou cron do próprio worker (BullMQ repeatable). Grátis. |

---

## Detalhe dos pontos pagos

### 1. IA — por que trocar OpenAI

OpenAI **não tem free tier permanente** (só créditos iniciais que expiram). Cada mensagem
processada custaria dinheiro. Para o público-alvo (autônomos) e para "custo zero", usamos:

- **Google Gemini** (`gemini-2.0-flash`): free tier com limites diários altos, suporta
  **function calling** e **structured output** — tudo que o projeto precisa.
- **Groq** (`llama-3.3-70b`): grátis, latência muito baixa, bom fallback e para tarefas simples.

> A arquitetura de IA é feita atrás de uma **interface `LlmProvider`** (Strategy Pattern).
> Trocar Gemini → OpenAI no futuro é mudar 1 arquivo, sem tocar nas regras de negócio.
> Veja `docs/07-camada-ia.md`.

**Ponto-chave que já ajuda no custo:** o próprio spec pede um **motor de comandos sem IA**
(regex + regras). Estimamos que **80–90% das mensagens** ("ganhei 200", "saldo", "paguei água 90")
nunca chamam LLM. A IA só entra em frases compostas. Isso mantém o uso do free tier baixíssimo.

### 2. WhatsApp — por que adiar

A **WhatsApp Cloud API oficial** (Meta) cobra por conversa iniciada e exige verificação de
negócio (CNPJ, número dedicado). Não é "grátis" nem simples para um autônomo.

Estratégia:
- **MVP:** canal **Telegram** (grátis, ilimitado) + **Web Chat** (nosso próprio). Provam o produto.
- **Fase 2:** **WhatsApp** via **Evolution API** self-hosted (não-oficial, gratuito) — funciona,
  mas tem risco de bloqueio; usar com número de teste.
- **Fase 3 (se houver receita):** migrar para a API oficial.

A arquitetura de canais é **plugável** (interface `MessagingChannel`), então adicionar WhatsApp
depois não reescreve nada. Veja `docs/06-camada-de-canais.md`.

---

## Estimativa de custo mensal do MVP

| Item | Plano | Custo |
|---|---|---|
| Vercel Hobby | Free | R$ 0 |
| Supabase | Free | R$ 0 |
| Upstash Redis | Free | R$ 0 |
| Gemini + Groq | Free tier | R$ 0 |
| Telegram Bot | Free | R$ 0 |
| Sentry | Free | R$ 0 |
| GitHub Actions | Free | R$ 0 |
| API/Worker host | Fly.io free / Oracle Always Free | R$ 0 |
| **Total** | | **R$ 0/mês** |

> Único gasto opcional futuro: **domínio próprio** (~R$ 40/ano). Dá para usar subdomínio grátis
> (`*.vercel.app`) no início.

---

## O que muda na stack original (e o que fica igual)

**Fica igual:** Next.js, React, TS, Tailwind, shadcn/ui, TanStack Query, RHF, Zod, NestJS,
Prisma, BullMQ, Postgres, JWT, Docker, GitHub Actions, Sentry, pino.

**Muda:** `OpenAI → Gemini/Groq` (atrás de interface) · `WhatsApp oficial → Telegram no MVP`
(canal plugável) · `Redis gerenciado → Upstash Free`.

Nenhuma dessas trocas altera as regras de negócio — só as implementações de borda.
