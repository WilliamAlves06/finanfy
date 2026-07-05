# 08 — Motor de Regras (sem IA)

> O motor que interpreta mensagens simples **sem chamar LLM**. Objetivo: resolver 80–90% das
> mensagens com regex + regras, mantendo o uso do free tier de IA baixíssimo (ver `docs/00`).

## Onde fica

`apps/api/modules/chat/rule-engine/`. É chamado pelo **Message Router** (`docs/06`) **antes** da
IA. Se nenhum handler casar (ou a mensagem for ambígua/composta), o router encaminha para a
camada de IA (`docs/07`).

## Pipeline

```
texto cru
  → normalize()            (minúsculas, remove acento, "R$"/"reais" → número, vírgula→ponto)
  → RuleEngine.match()     (Chain of Responsibility: tenta handlers em ordem)
      ├─ casou  → handler.handle() → chama o UseCase → resposta
      └─ nenhum → retorna MISS → router chama a IA
```

## Normalização (pt-BR)

Antes de casar, o texto passa por `normalizeText`:
- minúsculas + remoção de acentos (`água` → `agua`).
- moeda: `R$ 90`, `90 reais`, `90,50`, `90.50` → valor em **centavos** (`9000`, `9050`).
- números por extenso comuns opcionais (fase 2): "cento e oitenta" → 180.
- trim de pontuação e espaços repetidos.

Utilitário em `packages/utils/money.ts` (`parseBRL → cents`) e `text.ts` (`normalizeText`).

## Chain of Responsibility (ordem importa)

Cada handler expõe `test(text): boolean` e `handle(ctx): Reply`. A engine tenta na ordem abaixo
e para no **primeiro** que casar. Handlers mais específicos vêm antes dos genéricos.

| # | Intenção | Exemplos que casam | Regex (simplificada) | UseCase |
|---|---|---|---|---|
| 1 | Saldo | `saldo`, `quanto tenho` | `/^(saldo|quanto (eu )?tenho)/` | UC-10 consultar |
| 2 | Reserva (guardar) | `guardei 300`, `caixinha 200`, `coloquei 50 na reserva` | `/(guardei|caixinha|reserva).*?(\d+)/` | UC-03 |
| 3 | Reserva (retirar) | `tirei 100 da caixinha`, `retirei 50 da reserva` | `/(tirei|retirei).*(caixinha|reserva)/` | UC-04 |
| 4 | Despesa | `paguei agua 90`, `gastei 35`, `paguei 20 de pao` | `/(paguei|gastei)\s+.*?(\d+)/` | UC-02 |
| 5 | Receita | `ganhei 180`, `recebi 200`, `recebi um pix` | `/(ganhei|recebi)\s+.*?(\d+|pix)/` | UC-01 |
| 6 | Relatório | `relatorio`, `quanto gastei`, `quanto sobrou` | `/(relatorio|quanto (gastei|recebi|sobrou))/` | UC-10 |
| 7 | Ajuda | `ajuda`, `oi`, `menu` | `/^(ajuda|oi|ola|menu|\?)/` | resposta fixa |

> A regex real fica em constantes testáveis (`rule-engine/patterns.ts`), não espalhada no código.

## Quando o motor NÃO resolve (cai na IA)

- **Frase composta / múltiplas ações:** "recebi 220 da Maria, paguei 35 de gasolina e guardei 50."
- **Ambiguidade:** valor sem verbo claro, ou verbo sem valor.
- **Faltam dados obrigatórios que exigem diálogo natural.**
- **Pergunta livre** fora dos padrões de relatório.

Nesses casos o handler retorna `MISS` e o router chama `docs/07`. A `Message.usedAi` registra
`true` para métrica de custo.

## Fluxo de confirmação (operações ambíguas)

Mesmo no motor de regras, dados que faltam **não são assumidos**:
- Receita sem origem → pergunta a origem antes de gravar (UC-01).
- Despesa sem forma de pagamento → pergunta a forma (UC-02).
- Retirada de caixinha sem destino → pergunta o destino (UC-04).

A conversa fica **stateful**: o handler pode devolver um estado "aguardando origem/forma/destino"
guardado na sessão (`Conversation`), e a **próxima** mensagem curta ("pix", "cartão", "apenas")
completa a ação sem chamar IA.

## Anti-duplicação

Antes de gravar, checa se há registro idêntico (mesmo valor/tipo/dia) criado nos últimos N
segundos → evita lançar 2x quando o usuário repete a mensagem. Regra compartilhada com a IA.

## Testes (obrigatórios)

- Tabela de casos: cada linha da tabela acima → entrada casa no handler certo e extrai o valor certo.
- Normalização: "R$ 90,50", "90 reais", "noventa reais" → centavos corretos.
- MISS: frase composta cai para IA.
- Confirmação: receita sem origem não grava e pede origem; próxima msg completa.
- Ordem da chain: "paguei 50 da caixinha" casa despesa-caixinha, não guardar-reserva.
