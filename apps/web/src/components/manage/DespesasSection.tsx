'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { centsToBRL, reaisToCents } from '@/lib/money';
import { Card, DangerButton, EmptyState, Field, Input, PrimaryButton, Select } from './common';

interface Expense {
  id: string;
  amountCents: number;
  method: string;
  note?: string | null;
  category?: { name: string } | null;
  card?: { name: string } | null;
}
interface CardOpt {
  id: string;
  name: string;
}

const METHODS = ['DINHEIRO', 'PIX', 'SALDO', 'CAIXINHA', 'CARTAO'];
const EMPTY = { amount: '', method: 'DINHEIRO', note: '', cardId: '' };

export function DespesasSection() {
  const [items, setItems] = useState<Expense[]>([]);
  const [cards, setCards] = useState<CardOpt[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: Expense[] }>('/expenses?pageSize=30')
      .then((r) => setItems(r.data))
      .catch(() => {});
    api<CardOpt[]>('/cards')
      .then(setCards)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function add() {
    setError('');
    const amountCents = reaisToCents(form.amount);
    if (!amountCents) return setError('Informe o valor.');
    if (form.method === 'CARTAO' && !form.cardId) return setError('Escolha o cartão.');
    const body: Record<string, unknown> = {
      amountCents,
      method: form.method,
      note: form.note || undefined,
    };
    if (form.method === 'CARTAO') body.cardId = form.cardId;
    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify(body) });
      setForm(EMPTY);
      load();
    } catch {
      setError('Não consegui registrar. Confira os dados.');
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta despesa? O saldo será ajustado.')) return;
    await api(`/expenses/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Nova despesa (hoje)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Valor (R$)">
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="90"
            />
          </Field>
          <Field label="Forma de pagamento">
            <Select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          {form.method === 'CARTAO' && (
            <Field label="Cartão">
              <Select
                value={form.cardId}
                onChange={(e) => setForm({ ...form, cardId: e.target.value })}
              >
                <option value="">Escolha…</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Descrição (opcional)">
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Mercado"
            />
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3">
          <PrimaryButton onClick={add}>Adicionar</PrimaryButton>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState text="Nenhuma despesa registrada ainda." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-red-700">{centsToBRL(e.amountCents)}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {e.method.toLowerCase()}
                    {e.card ? ` · ${e.card.name}` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </div>
                <DangerButton onClick={() => remove(e.id)}>Excluir</DangerButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
