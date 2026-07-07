import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/repository/tenant-scope';
import { formatCents } from '../../common/utils/dates';

/** UC-08 — Metas e aportes. */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, data: { name: string; targetCents: number; deadline?: string }) {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        name: data.name,
        targetCents: data.targetCents,
        deadline: data.deadline ? new Date(`${data.deadline}T00:00:00.000Z`) : undefined,
      },
    });
    await this.audit.log({
      userId,
      action: 'goal.create',
      entity: 'Goal',
      entityId: goal.id,
      after: goal,
    });
    return goal;
  }

  async list(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: tenantWhere(userId),
      include: { contributions: true },
    });
    return goals.map((g) => {
      const savedCents = g.contributions.reduce((sum, c) => sum + c.amountCents, 0);
      return {
        ...g,
        savedCents,
        savedFormatted: formatCents(savedCents),
        targetFormatted: formatCents(g.targetCents),
        progress: g.targetCents > 0 ? Math.min(1, savedCents / g.targetCents) : 0,
        reached: savedCents >= g.targetCents,
      };
    });
  }

  async update(
    userId: string,
    id: string,
    data: Partial<{ name: string; targetCents: number; deadline: string }>,
  ) {
    const existing = await this.prisma.goal.findFirst({ where: tenantWhere(userId, { id }) });
    if (!existing) throw new NotFoundException('Meta não encontrada.');
    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        name: data.name,
        targetCents: data.targetCents,
        deadline: data.deadline ? new Date(`${data.deadline}T00:00:00.000Z`) : undefined,
      },
    });
    await this.audit.log({
      userId,
      action: 'goal.update',
      entity: 'Goal',
      entityId: id,
      before: existing,
      after: goal,
    });
    return goal;
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.goal.findFirst({ where: tenantWhere(userId, { id }) });
    if (!existing) throw new NotFoundException('Meta não encontrada.');
    await this.prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ userId, action: 'goal.delete', entity: 'Goal', entityId: id });
  }

  async contribute(userId: string, goalId: string, amountCents: number) {
    const goal = await this.prisma.goal.findFirst({ where: tenantWhere(userId, { id: goalId }) });
    if (!goal) throw new NotFoundException('Meta não encontrada.');

    await this.prisma.goalContribution.create({ data: { goalId, amountCents } });
    await this.audit.log({
      userId,
      action: 'goal.contribute',
      entity: 'Goal',
      entityId: goalId,
      after: { amountCents },
    });

    const all = await this.list(userId);
    return all.find((g) => g.id === goalId);
  }
}
