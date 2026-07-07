'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getTokens } from '@/lib/api';
import { TelegramCard } from '@/components/TelegramCard';

interface Dashboard {
  summary: {
    balanceFormatted: string;
    reserveFormatted: string;
    pendingBillsCount: number;
    pendingBillsCents: number;
  };
  monthly: { incomeFormatted: string; expenseFormatted: string; leftFormatted: string };
  canSpend: { canSpendFormatted: string };
  byCategory: { category: string; cents: number; formatted: string }[];
  upcoming: { id: string; name: string; formatted: string; dueDate: string; overdue: boolean }[];
  recent: { type: 'income' | 'expense'; formatted: string; label: string; note: string | null }[];
  cards: { id: string; name: string; limitFormatted: string; availableFormatted: string }[];
  dailyAvgIncomeFormatted: string;
  forecastFormatted: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [d, setD] = useState<Dashboard | null>(null);

  const load = useCallback(() => {
    api<Dashboard>('/reports/dashboard')
      .then(setD)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login');
      return;
    }
    load();
    // atualiza sozinho a cada 10s (sem precisar recarregar a página)
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [router, load]);

  const s = d?.summary;
  const hasAnyData = d && (d.recent.length > 0 || d.cards.length > 0 || d.upcoming.length > 0);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-600">Painel</h1>
        <Link className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white" href="/chat">
          💬 Conversar com o Fin
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Saldo" value={s?.balanceFormatted ?? '—'} accent="text-emerald-600" />
        <Card title="Caixinha" value={s?.reserveFormatted ?? '—'} accent="text-blue-600" />
        <Card
          title="Posso gastar"
          value={d?.canSpend.canSpendFormatted ?? '—'}
          accent="text-slate-800"
        />
        <Card
          title="Previsto p/ fim do mês"
          value={d?.forecastFormatted ?? '—'}
          accent="text-slate-800"
        />
      </section>

      {d && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow">
          <h2 className="font-semibold">Este mês</h2>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <Stat label="Entrou" value={d.monthly.incomeFormatted} color="text-emerald-600" />
            <Stat label="Saiu" value={d.monthly.expenseFormatted} color="text-red-600" />
            <Stat label="Sobrou" value={d.monthly.leftFormatted} color="text-slate-800" />
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">
            Receita diária média: <b>{d.dailyAvgIncomeFormatted}</b>
          </p>
        </section>
      )}

      {/* Estado vazio: nada cadastrado ainda */}
      {d && !hasAnyData && (
        <section className="mt-6 rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-8 text-center">
          <p className="text-lg font-medium">Vamos começar? 🌱</p>
          <p className="mt-1 text-sm text-slate-500">
            Você ainda não registrou nada. Fale com o Fin e diga algo como &quot;ganhei 180&quot;.
          </p>
          <Link
            className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white"
            href="/chat"
          >
            Registrar meu primeiro valor
          </Link>
        </section>
      )}

      {d && d.upcoming.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow">
          <h2 className="font-semibold">Próximas contas a vencer</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {d.upcoming.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span className={u.overdue ? 'text-red-600' : 'text-slate-700'}>
                  {u.overdue ? '⚠️ ' : '📅 '}
                  {u.name}
                </span>
                <span className="font-medium">
                  {u.formatted} · {new Date(u.dueDate).toLocaleDateString('pt-BR')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel
          title="Últimas movimentações"
          empty={!d || d.recent.length === 0}
          emptyText="Nenhuma ainda."
        >
          <ul className="mt-2 space-y-1 text-sm">
            {d?.recent.map((m, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-slate-600">
                  {m.type === 'income' ? '🟢' : '🔴'} {m.note ?? m.label}
                </span>
                <span className={m.type === 'income' ? 'text-emerald-700' : 'text-red-700'}>
                  {m.type === 'income' ? '+' : '−'}
                  {m.formatted}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Gasto por categoria (mês)"
          empty={!d || d.byCategory.length === 0}
          emptyText="Sem despesas ainda."
        >
          <ul className="mt-2 space-y-1.5">
            {d?.byCategory.slice(0, 6).map((c, i) => {
              const max = d.byCategory[0]?.cents || 1;
              return (
                <li key={i}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{c.category}</span>
                    <span className="font-medium">{c.formatted}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                    <div
                      className="h-1.5 rounded bg-emerald-500"
                      style={{ width: `${Math.max(6, (c.cents / max) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow">
        <h2 className="font-semibold">Cartões</h2>
        {!d || d.cards.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">
            Você ainda não tem cartão. Fale com o Fin: &quot;cadastrar cartão Nubank&quot;.
          </div>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {d.cards.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-slate-700">💳 {c.name}</span>
                <span className="text-slate-600">
                  Disponível <b className="text-emerald-700">{c.availableFormatted}</b> de{' '}
                  {c.limitFormatted}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TelegramCard />
    </main>
  );
}

function Card({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-1 text-xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  empty,
  emptyText,
  children,
}: {
  title: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <h2 className="font-semibold">{title}</h2>
      {empty ? <p className="mt-2 text-sm text-slate-400">{emptyText}</p> : children}
    </div>
  );
}
