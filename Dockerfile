# API Finanfy — imagem única e simples (Render free / qualquer host Docker)
FROM node:22-slim

# openssl é exigido pelo engine do Prisma em imagens slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# pnpm fixo via npm (evita bugs de assinatura do corepack em CI)
RUN npm i -g pnpm@9.15.9

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
RUN pnpm --filter @finanfy/api build

ENV NODE_ENV=production
EXPOSE 3001
# aplica migrações pendentes antes de subir (idempotente)
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node apps/api/dist/main.js"]
