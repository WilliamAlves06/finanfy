# 15 — Deploy (100% grátis)

> Web na **Vercel** (hobby) · API no **Render** (free) · banco já está no **Supabase**.
> Custo: **R$ 0/mês**. Siga na ordem: primeiro a API, depois o web, depois o Telegram.

---

## Parte 1 — API no Render (~10 min)

O repositório já tem o arquivo `render.yaml` que configura tudo sozinho (Blueprint).

1. Acesse **[render.com](https://render.com)** → **Get Started** → entre com a sua conta do **GitHub** (botão "Sign in with GitHub").
2. No painel, clique em **New +** (canto superior direito) → **Blueprint**.
3. Ele vai pedir acesso aos seus repositórios → autorize e escolha **WilliamAlves06/finanfy**.
4. O Render lê o `render.yaml` e mostra o serviço **finanfy-api**. Clique em **Apply/Deploy**.
5. Ele vai pedir os valores das variáveis marcadas como secretas. **Copie do seu arquivo `.env` local** (na raiz do projeto):
   - `DATABASE_URL` → a linha DATABASE_URL do .env (com `?pgbouncer=true`)
   - `DIRECT_URL` → a linha DIRECT_URL do .env
   - `GEMINI_API_KEY` → sua chave do Gemini
   - `TELEGRAM_BOT_TOKEN` → o token do @finanfybot
   - `TELEGRAM_WEBHOOK_SECRET` → a linha do .env
   - `WEB_ORIGIN` → deixe `https://finanfy.vercel.app` por enquanto (ajustamos depois se a URL da Vercel for outra)
6. Aguarde o build (5–8 min na primeira vez). Quando aparecer **Live** 🟢, copie a URL
   (algo como `https://finanfy-api.onrender.com`).
7. **Teste:** abra `https://SUA-URL.onrender.com/health` no navegador → deve mostrar `{"status":"ok"}`.

> ⚠️ O plano free do Render **hiberna após 15 min sem uso** (a primeira requisição depois
> demora ~50s). Por isso existe o workflow **Keepalive** (Parte 4), que pinga a API a cada
> 10 min e a mantém acordada — essencial para a notificação das 18h funcionar.

## Parte 2 — Web na Vercel (~5 min)

1. Acesse **[vercel.com](https://vercel.com)** → **Sign Up/Login com GitHub**.
2. **Add New → Project** → escolha o repositório **finanfy** → **Import**.
3. Em **Root Directory**, clique em **Edit** e selecione **`apps/web`** ← (importante!)
4. Em **Environment Variables**, adicione:
   - Nome: `NEXT_PUBLIC_API_URL` · Valor: a URL do Render da Parte 1 (ex.: `https://finanfy-api.onrender.com`) — **sem barra no final**.
5. Clique em **Deploy**. Em ~2 min você recebe a URL (ex.: `https://finanfy.vercel.app`).
6. **Se a URL for diferente** de `https://finanfy.vercel.app`: volte ao Render →
   finanfy-api → Environment → edite `WEB_ORIGIN` com a URL real da Vercel → Save (a API reinicia sozinha).
7. **Teste:** abra a URL da Vercel, crie sua conta e mande um "oi" pro Fin. 🎉

## Parte 3 — Telegram (~2 min)

Com a API no ar, registre o webhook do bot. Abra o PowerShell e rode (troque `SUA-URL-RENDER`):

```powershell
$token = "8548101309:AAGdfHG5K-KTHhxgJK2D6MypXIcAZEKJFU4"
$secret = (Get-Content .env | Select-String 'TELEGRAM_WEBHOOK_SECRET').ToString().Split('"')[1]
Invoke-RestMethod "https://api.telegram.org/bot$token/setWebhook?url=https://SUA-URL-RENDER.onrender.com/v1/channels/telegram/webhook&secret_token=$secret"
```

Deve responder `"ok": true`. Depois:

1. No painel web (Vercel) → **Painel → Conectar Telegram → Gerar código**.
2. No Telegram, procure **@finanfybot** → envie: `vincular SEU_CODIGO`.
3. Pronto! Mande "ganhei 100" pro bot. 💬

> 💡 Se preferir, me passe a URL do Render que **eu configuro o webhook para você**.

## Parte 4 — Keepalive (1 min)

Mantém a API acordada no free tier:

1. No GitHub: **repositório finanfy → Settings → Secrets and variables → Actions → aba Variables**.
2. **New repository variable** → Nome: `API_URL` · Valor: `https://SUA-URL.onrender.com`.
3. O workflow `keepalive.yml` (já no repo) passa a pingar a cada 10 min automaticamente.

---

## Resumo do que fica no ar

| Peça                | Onde     | URL                                |
| ------------------- | -------- | ---------------------------------- |
| Web (painel + chat) | Vercel   | `https://finanfy.vercel.app`       |
| API + crons         | Render   | `https://finanfy-api.onrender.com` |
| Banco               | Supabase | (interno)                          |
| Bot                 | Telegram | @finanfybot                        |

## Problemas comuns

- **Web mostra "não consegui responder"** → `NEXT_PUBLIC_API_URL` errada na Vercel (redeploy após corrigir) ou `WEB_ORIGIN` errada no Render (CORS).
- **Primeira mensagem demora ~50s** → API estava hibernada; confira a Parte 4.
- **Bot não responde** → refaça o `setWebhook` (Parte 3) e veja `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
- **Erro de banco no Render** → confira se `DATABASE_URL` tem `?pgbouncer=true` e a senha certa.
