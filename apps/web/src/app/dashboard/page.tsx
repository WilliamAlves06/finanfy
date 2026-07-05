'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getTokens } from '@/lib/api';

interface Summary {
  balanceFormatted: string;
  reserveFormatted: string;
  pendingBillsCount: number;
  pendingBillsCents: number;
}

interface Monthly {
  incomeFormatted: string;
  expenseFormatted: string;
  leftFormatted: string;
  incomeCount: number;
  expenseCount: number;
}

interface CanSpend {
  canSpendFormatted: string;
}

interface Entry {
  id: string;
  amountCents: number;
  note?: string | null;
  source?: string;
  method?: string;
  category?: { name: string } | null;
  client?: { name: string } | null;
}

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [canSpend, setCanSpend] = useState<CanSpend | null>(null);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login');
      return;
    }
    api<Summary>('/reports/summary').then(setSummary).catch(() => {});
    api<Monthly>('/reports/monthly').then(setMonthly).catch(() => {});
    api<CanSpend>('/reports/can-spend').then(setCanSpend).catch(() => {});
    api<{ data: Entry[] }>('/incomes?pageSize=5').then((r) => setIncomes(r.data)).catch(() => {});
    api<{ data: Entry[] }>('/expenses?pageSize=5').then((r) => setExpenses(r.data)).catch(() => {});
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-emerald-600">Painel</h1>
        <Link className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white" href="/chat">
          💬 Conversar com o Fin
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Saldo" value={summary?.balanceFormatted ?? '—'} accent="text-emerald-600" />
        <Card title="Caixinha" value={summary?.reserveFormatted ?? '—'} accent="text-blue-600" />
        <Card title="Posso gastar" value={canSpend?.canSpendFormatted ?? '—'} accent="text-slate-800" />
        <Card
          title="Contas pendentes"
          value={summary ? `${summary.pendingBillsCount} (${money(summary.pendingBillsCents)})` : '—'}
          accent={summary && summary.pendingBillsCount > 0 ? 'text-red-600' : 'text-slate-800'}
        />
      </section>

      {monthly && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow">
          <h2 className="font-semibold">Este mês</h2>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-sm text-slate-500">Entrou</div>
              <div className="text-lg font-bold text-emerald-600">{monthly.incomeFormatted}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Saiu</div>
              <div className="text-lg font-bold text-red-600">{monthly.expenseFormatted}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Sobrou</div>
              <div className="text-lg font-bold">{monthly.leftFormatted}</div>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <ListCard
          title="Últimas receitas"
          entries={incomes}
          render={(e) => `${money(e.amountCents)} · ${e.source ?? ''}${e.client ? ` · ${e.client.name}` : ''}`}
          color="text-emerald-700"
        />
        <ListCard
          title="Últimas despesas"
          entries={expenses}
          render={(e) => `${money(e.amountCents)} · ${e.method ?? ''}${e.note ? ` · ${e.note}` : ''}`}
          color="text-red-700"
        />
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow">
        <h2 className="font-semibold">Conectar Telegram</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fale com o Fin pelo Telegram: gere um código e mande <code>vincular CODIGO</code> para o bot.
        </p>
        {linkCode ? (
          <p className="mt-3 text-2xl font-bold tracking-widest text-emerald-600">{linkCode}</p>
        ) : (
          <button
            className="mt-3 rounded-xl border border-emerald-600 px-4 py-2 text-emerald-700"
            onClick={() =>
              api<{ code: string }>('/channels/telegram/link-code').then((r) => setLinkCode(r.code))
            }
          >
            Gerar código
          </button>
        )}
      </section>
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

function ListCard({
  title,
  entries,
  render,
  color,
}: {
  title: string;
  entries: Entry[];
  render: (e: Entry) => string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <h2 className="font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Nada por aqui ainda.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {entries.map((e) => (
            <li key={e.id} className={`text-sm ${color}`}>
              {render(e)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
