import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatService } from '../chat/chat.service';
import { TelegramService } from './telegram.service';

interface TelegramUpdate {
  message?: { chat?: { id?: number | string }; text?: string };
}

@ApiTags('channels')
@Controller('channels/telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly chat: ChatService,
  ) {}

  /** Código de vínculo — mostrado no painel web (docs/11 Configurações). */
  @Get('link-code')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  linkCode(@CurrentUser() userId: string) {
    return this.telegram.generateLinkCode(userId);
  }

  /** Webhook público do bot (protegido pelo secret token do Telegram). */
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) throw new ForbiddenException();

    const chatId = update.message?.chat?.id?.toString();
    const text = update.message?.text?.trim();
    if (!chatId || !text) return { ok: true };

    // fluxo de vínculo: "vincular 123456" (docs/06)
    const linkMatch = text.match(/^\/?vincular\s+(\d{6})$/i);
    if (linkMatch) {
      const ok = await this.telegram.tryLink(linkMatch[1]!, chatId);
      await this.telegram.send(
        chatId,
        ok
          ? 'Pronto! Sua conta está conectada. 🎉 Pode falar comigo: "ganhei 180", "saldo"...'
          : 'Código inválido ou expirado. Gere um novo no painel (Configurações → Conectar Telegram).',
      );
      return { ok: true };
    }

    const userId = await this.telegram.resolveUser(chatId);
    if (!userId) {
      await this.telegram.send(
        chatId,
        'Oi! 👋 Para começar, conecte sua conta: entre no painel do Finanfy, vá em Configurações → Conectar Telegram e me mande: vincular SEU_CODIGO',
      );
      return { ok: true };
    }

    const reply = await this.chat.handleMessage(userId, text, 'TELEGRAM');
    await this.telegram.send(chatId, reply.text, reply.quickReplies);
    return { ok: true };
  }
}
