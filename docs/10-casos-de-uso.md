# 10 — Casos de Uso

> Formato: **Ator · Gatilho · Pré-condições · Fluxo principal · Alternativos · Regras · Pós-condições · Função IA · Testes**.
> "Função IA" = nome da função exposta ao LLM via function calling (`docs/07`). Cada caso de uso
> tem uma classe `XUseCase.execute()` em `application/`.

---

## UC-01 — Registrar receita

- **Ator:** usuário. **Gatilho:** "ganhei 180" / "recebi um PIX" / botão no painel.
- **Pré:** autenticado (tenant resolvido).
- **Fluxo principal:**
  1. Sistema identifica valor e, se faltar, **pergunta a origem** (Diária, PIX, Salário, Venda, Outro).
  2. Opcionalmente pergunta/associa cliente e categoria.
  3. Grava `Income` com `date = hoje`, atualiza `User.balanceCents` na mesma transação, grava `AuditLog`.
  4. Responde com confirmação + **saldo atualizado**.
- **Alternativos:**
  - Origem não informada e não inferível → pergunta antes de gravar.
  - Valor ambíguo/ausente → pede confirmação; **nunca assume** valor.
- **Regras:** ⚠️ **origem sempre obrigatória**; ⚠️ **sem retroativo** (data ≠ hoje é rejeitada);
  várias receitas no mesmo dia são permitidas.
- **Pós:** saldo aumentado; dia deixa de ser "dia perdido".
- **Função IA:** `registrar_receita(valor, origem, clienteId?, categoriaId?)`.
- **Testes:** rejeita data≠hoje; soma no saldo; exige origem; aceita 2 receitas no mesmo dia.

## UC-02 — Registrar despesa

- **Ator:** usuário. **Gatilho:** "paguei água 90" / "gastei 35 de gasolina".
- **Fluxo principal:**
  1. Identifica valor (+ categoria se possível).
  2. ⚠️ **Sempre pergunta a forma de pagamento**: Dinheiro, Saldo, Caixinha, Cartão, PIX.
  3. Aplica efeito conforme o método:
     - `SALDO` → abate `User.balanceCents`.
     - `CAIXINHA` → abate `Reserve.balanceCents` (via `ReserveMovement OUT`).
     - `CARTAO` → cria `Installment`/associa `Invoice`; **não** mexe no saldo agora.
     - `DINHEIRO`/`PIX` → registra despesa; efeito no saldo conforme configuração do módulo.
  4. Grava `Expense` + `AuditLog` em transação; responde com saldo atualizado.
- **Alternativos:** forma não informada → **pergunta** (nunca infere); saldo insuficiente → avisa e confirma.
- **Regras:** ⚠️ **forma de pagamento nunca é assumida**.
- **Função IA:** `registrar_despesa(valor, forma, categoriaId?, cartaoId?)`.
- **Testes:** cada método afeta a fonte certa; sem `forma` não grava; cartão não altera saldo disponível.

## UC-03 — Guardar na caixinha

- **Gatilho:** "guardei 300" / "coloquei na reserva".
- **Fluxo:** cria `ReserveMovement IN`, soma `Reserve.balanceCents`; opcionalmente debita do saldo
  disponível se o dinheiro veio de lá (perguntar a origem se ambíguo). Responde saldo da reserva.
- **Regras:** ⚠️ caixinha **nunca** recebe automático — só por ordem explícita.
- **Função IA:** `guardar_caixinha(valor, origem?)`.
- **Testes:** aumenta reserva; não roda sem ordem explícita.

## UC-04 — Retirar da caixinha

- **Gatilho:** "tirei 100 da caixinha".
- **Fluxo:**
  1. Identifica valor. ⚠️ **Pergunta o destino.**
  2. Se **"retirei apenas"** → cria `ReserveMovement OUT`, **só diminui** a reserva. Nada mais.
  3. Se **"foi pagar uma conta"** → cria `ReserveMovement OUT` com `reason`, diminui a reserva,
     e ⚠️ **NÃO cria `Expense`**.
  4. Sempre informa o saldo atualizado da reserva.
- **Regras:** ⚠️ pagar conta pela caixinha **não gera despesa**; destino sempre perguntado.
- **Função IA:** `retirar_caixinha(valor, destino)` — `destino ∈ {apenas, pagar_conta}`.
- **Testes:** "retirei apenas" não cria Expense; "pagar conta" não cria Expense; ambos abatem reserva.

## UC-05 — Gerar cobranças recorrentes (mensal, automático)

- **Ator:** worker (cron mensal). **Gatilho:** virada de mês.
- **Fluxo:** para cada `RecurringBill` ativa, cria uma `RecurringCharge` do mês (status `PENDING`,
  `dueDate` pelo `dueDay`). Idempotente via unique `(recurringBillId, year, month)`.
- **Regras:** ⚠️ cobrança não paga do mês anterior **permanece PENDENTE**; **nunca é apagada**;
  o novo mês gera **outra** cobrança.
- **Testes:** rodar o job 2x não duplica; pendência antiga continua; nova cobrança criada.

## UC-06 — Pagar conta recorrente

- **Gatilho:** "paguei a água" / ação no painel.
- **Fluxo:** localiza `RecurringCharge` pendente, pergunta a forma de pagamento (UC-02), cria a
  `Expense` vinculada (`recurringChargeId`), marca a cobrança `PAID`.
- **Função IA:** `pagar_conta(contaId|nome, forma)`.
- **Testes:** marca PAID; vincula Expense; forma obrigatória.

## UC-07 — Compra no cartão

- **Gatilho:** despesa com `forma = CARTAO` (opcionalmente parcelada).
- **Fluxo:** cria `Installment`(s), associa/gera `Invoice` do mês de fechamento correto (usa
  `closingDay`), atualiza `disponível` derivado do cartão. Não mexe no saldo disponível.
- **Testes:** parcelamento distribui em faturas certas; disponível = limite − abertas − parcelas futuras.

## UC-08 — Criar meta e aportar

- **Gatilho:** "quero juntar 1000 pra um celular" / painel.
- **Fluxo:** cria `Goal`; aportes criam `GoalContribution`. Notifica quando atinge alvo (UC-09).
- **Função IA:** `criar_meta(nome, alvo, prazo?)`, `aportar_meta(metaId, valor)`.

## UC-09 — Notificações

- **Ator:** worker. **Gatilhos/regras:**
  - **18:00 diário:** se o usuário **não tem receita hoje** → "Você ainda não registrou quanto ganhou hoje."
  - Conta perto do vencimento / fatura próxima → lembrete.
  - Saldo negativo → alerta.
  - Meta atingida → parabéns.
- **Fluxo:** cria `Notification (PENDING)`, worker envia pelo canal preferido do usuário, marca `SENT`.
- **Testes:** com receita hoje não dispara "sem receita"; dispara às 18h quando ausente; vencimento gera lembrete.

## UC-10 — Consultar (relatórios)

- **Gatilho:** "quanto tenho?", "quanto posso gastar?", "quanto sobrou no mês?", "quais contas venceram?".
- **Fluxo:** consultas de **leitura (CQRS query)**, sem efeito colateral, respondidas em linguagem simples.
- **Função IA:** `consultar(tipo, periodo?)`. Ver perguntas suportadas em `docs/01`.
- **Testes:** cada pergunta retorna o número correto em cenários montados.

## Rastreabilidade (caso de uso → backlog → regra)

| UC       | Tarefa backlog (`docs/05`) | Regra inegociável coberta                           |
| -------- | -------------------------- | --------------------------------------------------- |
| UC-01    | T1.3                       | sem retroativo, origem obrigatória                  |
| UC-02    | T1.4                       | forma sempre perguntada                             |
| UC-03/04 | T2.1                       | caixinha só explícita; pagar conta não vira despesa |
| UC-05/06 | T2.3                       | pendência nunca apagada; não duplica                |
| UC-07    | T2.2                       | cartão não mexe no saldo                            |
| UC-08    | T2.4                       | —                                                   |
| UC-09    | T6.1                       | notificação 18h                                     |
| UC-10    | T1.5 / T6.2                | —                                                   |
