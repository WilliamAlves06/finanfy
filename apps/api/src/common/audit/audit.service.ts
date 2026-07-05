import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditChannel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API';

export interface AuditEntry {
  userId: string;
  /** ex.: "income.create", "reserve.withdraw" */
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  channel?: AuditChannel;
}

/**
 * Trilha de auditoria imutável (docs/03) — toda escrita de negócio registra
 * quem, o quê, antes/depois e por qual canal. Chamado pelos use cases,
 * dentro da mesma transação quando possível.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cliente transacional opcional — permite auditar dentro de $transaction. */
  async log(entry: AuditEntry, tx?: Pick<PrismaService, 'auditLog'>): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
        after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
        channel: entry.channel,
      },
    });
  }
}
