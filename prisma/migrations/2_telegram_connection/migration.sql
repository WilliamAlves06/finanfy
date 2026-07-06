-- Conexão do Telegram: metadados do canal + códigos de vínculo persistidos
ALTER TABLE "ChannelIdentity" ADD COLUMN "displayName" TEXT;
ALTER TABLE "ChannelIdentity" ADD COLUMN "username" TEXT;
ALTER TABLE "ChannelIdentity" ADD COLUMN "connectedAt" TIMESTAMP(3);

CREATE TABLE "TelegramLinkCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramLinkCode_userId_key" ON "TelegramLinkCode"("userId");
CREATE UNIQUE INDEX "TelegramLinkCode_code_key" ON "TelegramLinkCode"("code");
CREATE INDEX "TelegramLinkCode_code_idx" ON "TelegramLinkCode"("code");

ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
