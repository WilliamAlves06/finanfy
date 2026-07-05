import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { softDeleteData, tenantWhere } from '../../common/repository/tenant-scope';

export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** Clientes do autônomo (Maria, João, Empresa XYZ) — docs/01. */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    data: { name: string; phone?: string; notes?: string; weekdays?: Weekday[] },
  ) {
    const client = await this.prisma.client.create({
      data: { ...data, userId, weekdays: data.weekdays ?? [] },
    });
    await this.audit.log({
      userId,
      action: 'client.create',
      entity: 'Client',
      entityId: client.id,
      after: client,
    });
    return client;
  }

  list(userId: string) {
    return this.prisma.client.findMany({ where: tenantWhere(userId), orderBy: { name: 'asc' } });
  }

  /** Busca cliente pelo nome (case-insensitive) — usado pelo chat/IA. */
  findByName(userId: string, name: string) {
    return this.prisma.client.findFirst({
      where: tenantWhere(userId, { name: { equals: name, mode: 'insensitive' as const } }),
    });
  }

  async update(
    userId: string,
    id: string,
    data: { name?: string; phone?: string; notes?: string; weekdays?: Weekday[] },
  ) {
    const existing = await this.prisma.client.findFirst({ where: tenantWhere(userId, { id }) });
    if (!existing) throw new NotFoundException('Cliente não encontrado.');
    const client = await this.prisma.client.update({ where: { id }, data });
    await this.audit.log({
      userId,
      action: 'client.update',
      entity: 'Client',
      entityId: id,
      before: existing,
      after: client,
    });
    return client;
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.client.findFirst({ where: tenantWhere(userId, { id }) });
    if (!existing) throw new NotFoundException('Cliente não encontrado.');
    await this.prisma.client.update({ where: { id }, data: softDeleteData() });
    await this.audit.log({ userId, action: 'client.delete', entity: 'Client', entityId: id });
  }
}
