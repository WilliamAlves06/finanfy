# 14 — Fluxogramas

> Diagramas Mermaid dos fluxos centrais. Renderizam no GitHub/VS Code.

## a) Ciclo de vida de uma mensagem

```mermaid
flowchart TD
    A[Mensagem recebida<br/>canal] --> B[Adapter normaliza<br/>IncomingMessage]
    B --> C{Tenant vinculado?}
    C -- não --> V[Fluxo de vínculo<br/>ChannelIdentity]
    C -- sim --> D[Message Router<br/>+ Conversation]
    D --> E{Motor de regras<br/>casou?}
    E -- sim --> F[UseCase executa]
    E -- não --> G[Camada IA<br/>intent + entities]
    G --> H{Dados completos?}
    H -- não --> Q[Pergunta com<br/>quick replies]
    H -- sim --> F
    F --> I[Grava + AuditLog<br/>atualiza saldo]
    I --> J[Resposta natural<br/>+ saldo]
    Q --> J
    J --> K[channel.send]
```

## b) Despesa por forma de pagamento

```mermaid
flowchart TD
    A[Registrar despesa] --> B{Forma informada?}
    B -- não --> P[Perguntar forma<br/>Dinheiro/PIX/Saldo/Caixinha/Cartão]
    P --> C
    B -- sim --> C{Qual forma?}
    C -- Saldo --> S[Abate User.balance]
    C -- Caixinha --> R[ReserveMovement OUT<br/>abate reserva]
    C -- Cartão --> T[Cria Installment<br/>associa Invoice]
    C -- Dinheiro/PIX --> D[Registra Expense]
    S --> Z[Grava Expense + AuditLog<br/>responde saldo]
    R --> Z
    T --> Z
    D --> Z
```

## c) Caixinha — retirar

```mermaid
flowchart TD
    A[Tirar da caixinha] --> B[Perguntar destino]
    B --> C{Destino}
    C -- Só retirar --> D[ReserveMovement OUT<br/>diminui reserva]
    C -- Pagar conta --> E[ReserveMovement OUT<br/>diminui reserva<br/>reason = conta]
    D --> F[Responde saldo da reserva]
    E --> F
    E -. NUNCA .-> X[[Criar Expense]]:::no
    classDef no stroke:#c00,stroke-dasharray:4;
```

## d) Contas recorrentes — geração mensal

```mermaid
flowchart TD
    A[Cron: virada de mês] --> B[Para cada RecurringBill ativa]
    B --> C{Já existe charge<br/>deste mês?}
    C -- sim --> S[Pular idempotente]
    C -- não --> D[Cria RecurringCharge<br/>status PENDING]
    D --> E[Charges antigas PENDING<br/>permanecem]
    E --> F[[Nunca apaga pendência]]
```

## e) Notificação das 18h

```mermaid
flowchart TD
    A[Cron 18:00 America/Sao_Paulo] --> B[Para cada usuário ativo]
    B --> C{Tem receita hoje?}
    C -- sim --> S[Não notificar sobre receita]
    C -- não --> D[Notification NO_INCOME_TODAY]
    B --> E{Contas a vencer?}
    E -- sim --> F[Notification BILL_DUE]
    B --> G{Saldo negativo?}
    G -- sim --> H[Notification NEGATIVE_BALANCE]
    D --> W[Worker envia pelo canal preferido]
    F --> W
    H --> W
    W --> Z[Marca SENT]
```
