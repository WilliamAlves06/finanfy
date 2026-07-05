// Seed idempotente — categorias padrão visíveis para todos os usuários (docs/04).
// Categorias padrão pertencem a um "usuário sistema" e têm isDefault=true;
// o use case de categorias lista (padrão + do próprio usuário) e bloqueia deletar padrão.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_EMAIL = 'system@finanfy.local';

const DEFAULT_CATEGORIES: { name: string; kind: 'INCOME' | 'EXPENSE' }[] = [
  // Receita
  { name: 'Diária', kind: 'INCOME' },
  { name: 'Serviço', kind: 'INCOME' },
  { name: 'Venda', kind: 'INCOME' },
  { name: 'PIX recebido', kind: 'INCOME' },
  { name: 'Outros (receita)', kind: 'INCOME' },
  // Despesa
  { name: 'Alimentação', kind: 'EXPENSE' },
  { name: 'Transporte/Combustível', kind: 'EXPENSE' },
  { name: 'Materiais', kind: 'EXPENSE' },
  { name: 'Contas de casa', kind: 'EXPENSE' },
  { name: 'Saúde', kind: 'EXPENSE' },
  { name: 'Outros (despesa)', kind: 'EXPENSE' },
];

async function main() {
  // usuário "sistema" dono das categorias padrão (não loga: hash inválido de propósito)
  const system = await prisma.user.upsert({
    where: { email: SYSTEM_EMAIL },
    update: {},
    create: {
      email: SYSTEM_EMAIL,
      passwordHash: '!system-no-login',
      name: 'Finanfy System',
    },
  });

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: system.id, name: cat.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: { userId: system.id, name: cat.name, kind: cat.kind, isDefault: true },
      });
    }
  }

  console.log(`Seed ok: ${DEFAULT_CATEGORIES.length} categorias padrão garantidas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
