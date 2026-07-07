'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTokens } from '@/lib/api';
import { CaixinhaSection } from '@/components/manage/CaixinhaSection';
import { CartoesSection } from '@/components/manage/CartoesSection';
import { CategoriasSection } from '@/components/manage/CategoriasSection';
import { ClientesSection } from '@/components/manage/ClientesSection';
import { ContasSection } from '@/components/manage/ContasSection';
import { DespesasSection } from '@/components/manage/DespesasSection';
import { MetasSection } from '@/components/manage/MetasSection';
import { ReceitasSection } from '@/components/manage/ReceitasSection';

const TABS = [
  { id: 'despesas', label: '🔴 Despesas', render: () => <DespesasSection /> },
  { id: 'receitas', label: '🟢 Receitas', render: () => <ReceitasSection /> },
  { id: 'cartoes', label: '💳 Cartões', render: () => <CartoesSection /> },
  { id: 'contas', label: '📅 Contas fixas', render: () => <ContasSection /> },
  { id: 'caixinha', label: '💙 Caixinha', render: () => <CaixinhaSection /> },
  { id: 'metas', label: '🎯 Metas', render: () => <MetasSection /> },
  { id: 'categorias', label: '🏷️ Categorias', render: () => <CategoriasSection /> },
  { id: 'clientes', label: '👥 Clientes', render: () => <ClientesSection /> },
] as const;

export default function GerenciarPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('despesas');

  useEffect(() => {
    if (!getTokens()) router.replace('/login');
  }, [router]);

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-600">Gerenciar</h1>
        <nav className="flex gap-3 text-sm">
          <Link className="text-emerald-700 underline" href="/dashboard">
            Painel
          </Link>
          <Link className="text-emerald-700 underline" href="/chat">
            Chat
          </Link>
        </nav>
      </header>

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              t.id === tab
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active.render()}
    </main>
  );
}
