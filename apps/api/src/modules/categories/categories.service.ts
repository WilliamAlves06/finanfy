import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { softDeleteData, tenantWhere } from '../../common/repository/tenant-scope';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista categorias padrão do sistema + as do próprio usuário. */
  list(userId: string) {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        OR: [{ isDefault: true }, { userId }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, data: { name: string; kind: 'INCOME' | 'EXPENSE' | 'BOTH' }) {
    const category = await this.prisma.category.create({
      data: { ...data, userId, isDefault: false },
    });
    await this.audit.log({
      userId,
      action: 'category.create',
      entity: 'Category',
      entityId: category.id,
      after: category,
    });
    return category;
  }

  async remove(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: tenantWhere(userId, { id }),
    });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    if (category.isDefault)
      throw new ForbiddenException('Categorias padrão não podem ser removidas.');

    await this.prisma.category.update({ where: { id }, data: softDeleteData() });
    await this.audit.log({
      userId,
      action: 'category.delete',
      entity: 'Category',
      entityId: id,
      before: category,
    });
  }
}
