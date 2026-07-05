# 13 — Testes e Qualidade

> As **regras de negócio inegociáveis** viram testes automatizados — são o contrato do produto.
> Ferramentas gratuitas: Vitest/Jest (unit), Supertest (E2E), Playwright (web, opcional).

## Pirâmide de testes

- **Unit (maioria):** um teste por caso de uso, com repositórios/LLM/canais **mockados**. Rápido,
  sem rede, sem banco. Cobre regras de domínio.
- **Integração:** repositórios Prisma contra Postgres de teste (docker-compose). Cobre queries,
  transações e isolamento de tenant.
- **E2E (poucos, críticos):** fluxos ponta-a-ponta via HTTP (register→login→registrar receita→saldo)
  e um fluxo de chat (motor de regras) sem IA.

## Regras que DEVEM ter teste (do briefing)

| Regra                            | Teste                                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| Receita sem retroativo           | `POST /incomes` com data≠hoje → 422; várias no mesmo dia → ok       |
| Origem da receita obrigatória    | sem origem não grava; pergunta origem                               |
| Despesa: forma sempre perguntada | sem `forma` → 400; nunca inferida                                   |
| Efeito por forma de pagamento    | SALDO abate saldo; CAIXINHA abate reserva; CARTÃO não mexe no saldo |
| Caixinha só por ordem explícita  | depósito automático nunca ocorre                                    |
| Retirar "apenas"                 | abate reserva, **não** cria Expense                                 |
| Retirar "pagar conta"            | abate reserva, **não** cria Expense                                 |
| Recorrente não duplica           | rodar job 2x no mesmo mês → 1 cobrança                              |
| Pendência nunca apagada          | cobrança não paga persiste; novo mês cria outra                     |
| Notificação 18h                  | com receita hoje não dispara; sem receita dispara                   |
| Isolamento multi-tenant          | tenant A nunca lê dado de B (query sem `userId` falha no teste)     |
| Anti-duplicação                  | mesma mensagem repetida em N s não lança 2x                         |

## Motor de regras / IA

- Tabela de padrões do `docs/08`: cada entrada casa no handler certo e extrai o valor certo.
- Normalização: "R$ 90,50", "90 reais" → centavos.
- IA com `LlmProvider` **mockado**: frase composta → sequência de tool calls esperada; guard-rails
  (valor ausente ⇒ pergunta). Nenhum teste chama a API real do Gemini/Groq.

## Cobertura (metas pragmáticas)

- Domínio/casos de uso (`application/` + `domain/`): **alvo ≥ 90%**.
- Regras inegociáveis: **100%** (lista acima).
- Controllers/adapters: cobertos pelos E2E principais; não perseguir 100%.

## Qualidade estática e CI

- **ESLint + Prettier** (config compartilhada). **TypeScript strict** (`strict: true`, sem `any` solto).
- **Zod/class-validator** em toda borda de entrada.
- **GitHub Actions** (`.github/workflows/ci.yml`): `install → lint → typecheck → test (unit+integração)`
  em cada PR, com Postgres/Redis via serviços. PR vermelho não faz merge.
- **Commits pequenos, 1 tarefa do backlog por PR** (`docs/05`), cada PR com seus testes.

## Definição de pronto (DoD) por tarefa

- [ ] Critérios de aceite da tarefa satisfeitos
- [ ] Testes unitários (e E2E se fluxo crítico) passando
- [ ] Lint + typecheck limpos
- [ ] Regras inegociáveis afetadas cobertas por teste
- [ ] Sem segredo/PII em logs; erros tratados
- [ ] Doc atualizada se o contrato mudou
