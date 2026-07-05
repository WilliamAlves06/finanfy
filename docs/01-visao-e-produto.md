# 01 — Visão e Produto

## O que é

**Finanfy** é um **assistente financeiro por conversa** para trabalhadores autônomos que
recebem por diária/serviço e têm pouca familiaridade com tecnologia.

O usuário **não preenche formulários** e **não navega em menus**. Ele **conversa**:

> "Ganhei 180." → registrado.
> "Quanto posso gastar hoje?" → resposta clara.

O sistema deve **parecer um contador pessoal**, nunca um app financeiro tradicional.

## Para quem

Faxineiras, diaristas, jardineiros, eletricistas, pedreiros, motoristas, cuidadores,
freelancers — qualquer pessoa que recebe por serviço. Baixa alfabetização digital é a regra,
não a exceção. **Cada palavra da interface e das respostas precisa ser simples e humana.**

## Princípios de produto

1. **Conversa primeiro.** Texto livre é a interface principal. Painel web é apoio, não o centro.
2. **Zero fricção.** Nunca pedir dado que dá para inferir ou perguntar de forma natural.
3. **Nunca assumir dinheiro.** Toda operação financeira ambígua é **confirmada** antes de gravar.
4. **Barato de rodar.** Regras/regex resolvem a maioria; IA só para frases complexas.
5. **Multicanal desde o dia 1.** Telegram, Web (e depois WhatsApp, App, API) usam o mesmo núcleo.
6. **Multi-tenant desde o dia 1.** Dados de um usuário nunca vazam para outro.

## Regras de negócio que definem o produto

Estas regras vêm do briefing e são **inegociáveis**. Viram testes.

### Receitas

- Sempre perguntar a **origem** (Diária, PIX, Salário, Venda, Outro).
- Várias receitas no mesmo dia: **permitido**.
- **Não** permitir lançamento retroativo. Esqueceu o dia? **Dia perdido** (não registra pra trás).

### Despesas

- **Sempre perguntar como foi paga:** Dinheiro, Saldo disponível, Caixinha, Cartão, PIX.
- **Nunca** assumir a forma de pagamento automaticamente.

### Caixinha (reserva)

- **Nunca** recebe dinheiro automático — só quando o usuário manda ("guardei 300").
- Ao retirar, **perguntar o destino**:
  - "Retirei apenas" → só **diminui** o saldo da caixinha.
  - "Foi pagar uma conta" → **diminui só da caixinha**, e **não cria nova despesa**.
- Sempre informar o **saldo atualizado** após mexer na caixinha.

### Cartões

- Cadastrados pelo painel. Controlam limite, disponível, parcelas, faturas, fechamento, vencimento.
- Vários cartões por usuário.

### Contas recorrentes

- Criadas pelo painel. Todo mês **geram automaticamente** uma cobrança.
- Se não paga, **continua pendente** e no mês seguinte **cria nova cobrança** — **nunca apaga** a pendência.

### Notificações

- Todo dia **18:00**: se não houver receita registrada → "Você ainda não registrou quanto ganhou hoje."
- Lembretes de: contas perto do vencimento, faturas, saldo negativo.

### Relatórios (perguntas que o assistente responde)

Quanto tenho? Quanto posso gastar? Quanto gastei/recebi? Quanto tem na reserva?
Quais contas venceram? Qual cartão tem mais limite? Quanto sobrou no mês? Quanto economizei no ano?

## Conceitos financeiros do domínio (glossário)

- **Saldo disponível:** dinheiro "livre" do usuário (não inclui caixinha nem cartão).
- **Caixinha:** reserva separada; movimenta só por ordem explícita.
- **Cartão:** crédito; gera fatura; não mexe no saldo disponível na hora da compra.
- **Conta recorrente:** obrigação mensal (água, luz…) que gera cobrança todo mês.
- **Dia perdido:** dia sem receita registrada — fica registrado como ausência, não editável depois.

## O que NÃO é o MVP (escopo fechado)

Fora do MVP (mas a arquitetura já prevê): App Android/iOS, voz, OCR de comprovantes,
importação de extrato, Open Finance, multi-idioma, painel admin, assinaturas/planos pagos,
WhatsApp oficial. Ver `docs/05-roadmap-e-backlog.md`.
