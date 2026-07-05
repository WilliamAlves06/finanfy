# 11 — Wireframes (protótipo textual)

> Público de baixa familiaridade digital. Regra visual: **texto grande, poucos elementos por
> tela, o chat no centro, números claros em reais**. O painel é apoio; o chat é o produto.
> Wireframes de baixa fidelidade (ASCII) — viram telas shadcn/ui em `apps/web`.

## Princípios de UI

- 1 ação principal por tela. Botões grandes. Sem jargão financeiro.
- Perguntas do assistente sempre com **botões** (quick replies), nunca campo livre obrigatório.
- Cores: verde = entrou dinheiro, vermelho = saiu, azul = reserva.
- Sempre mostrar **saldo** no topo.

## Login

```
┌───────────────────────────┐
│         Finanfy           │
│  Seu dinheiro organizado  │
│                           │
│  E-mail  [_____________]  │
│  Senha   [_____________]  │
│      [   Entrar   ]       │
│   Criar conta · Esqueci   │
└───────────────────────────┘
```

## Chat (tela principal)

```
┌───────────────────────────┐
│ Saldo: R$ 245,00   ☰      │
├───────────────────────────┤
│  Você: ganhei 180         │
│  Fin: De onde veio? 🙂    │
│   [Diária][PIX][Venda]... │
│  Você: [Diária]           │
│  Fin: Anotado! ✅         │
│       Saldo: R$ 425,00    │
├───────────────────────────┤
│ [ Escreva aqui...    ] ➤  │
└───────────────────────────┘
```

## Dashboard

```
┌───────────────────────────┐
│ Olá, João 👋              │
│ ┌────────┐ ┌────────┐     │
│ │ Saldo  │ │Reserva │     │
│ │R$425,00│ │R$300,00│     │
│ └────────┘ └────────┘     │
│ Entrou hoje:  R$ 180,00   │
│ Gastou hoje:  R$  35,00   │
│ ── Fluxo do mês ────────  │
│  ▁▃▅▂▆▇▄  (barrinhas)     │
│ Contas a vencer: Água R$90│
│ [Receitas][Despesas][+]   │
└───────────────────────────┘
```

## Receitas (lista)

```
┌───────────────────────────┐
│ ← Receitas       [+ Nova] │
│ Hoje                      │
│  R$180,00  Diária · Maria │
│ Ontem                     │
│  R$200,00  PIX            │
│ Total do mês: R$ 2.340,00 │
└───────────────────────────┘
```

## Despesas (lista) — mostra a forma de pagamento

```
┌───────────────────────────┐
│ ← Despesas       [+ Nova] │
│  R$ 90,00  Água · Dinheiro│
│  R$ 35,00  Gasolina · PIX │
│  R$ 50,00  Pão · Cartão   │
│ Total do mês: R$ 640,00   │
└───────────────────────────┘
```

## Cartões

```
┌───────────────────────────┐
│ ← Cartões        [+ Novo] │
│  Nubank                   │
│  Limite R$1.000           │
│  Usado  R$ 350  ▓▓▓░░░░   │
│  Fecha dia 3 · Vence 10   │
│  Fatura atual: R$ 350,00  │
└───────────────────────────┘
```

## Caixinha (reserva)

```
┌───────────────────────────┐
│ ← Caixinha                │
│   Você tem                │
│   R$ 300,00 guardado      │
│  [ Guardar ] [ Retirar ]  │
│ ── Movimentos ──────────  │
│  +R$100  guardei          │
│  -R$ 50  paguei conta     │
└───────────────────────────┘
```

## Clientes

```
┌───────────────────────────┐
│ ← Clientes       [+ Novo] │
│  Maria   seg, qua, sex    │
│  João    ter, qui         │
│  Empresa XYZ              │
└───────────────────────────┘
```

## Relatórios

```
┌───────────────────────────┐
│ ← Relatórios              │
│ Pergunte ou toque:        │
│  [Quanto posso gastar?]   │
│  [Quanto sobrou no mês?]  │
│  [Contas vencidas?]       │
│  [Quanto economizei?]     │
│ ─────────────────────────  │
│ Você pode gastar hoje:    │
│      R$ 60,00             │
└───────────────────────────┘
```

## Configurações

```
┌───────────────────────────┐
│ ← Configurações           │
│  Perfil                   │
│  Conectar Telegram  [>]   │
│  Notificação 18h    [on]  │
│  Sair                     │
└───────────────────────────┘
```

> "Conectar Telegram" mostra um **código** para vincular o `ChannelIdentity` (`docs/06`).
