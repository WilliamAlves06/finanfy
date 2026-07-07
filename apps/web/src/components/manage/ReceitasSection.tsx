'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { centsToBRL, reaisToCents } from '@/lib/money';
import { Card, DangerButton, EmptyState, Field, Input, PrimaryButton, Select } from './common';

interface Income {
  id: string;
  amountCents: number;
  source: string;
  note?: string | null;
  client?: { name: string } | null;
}

const SOURCES = ['DIARIA', 'PIX', 'SALARIO', 'VENDA', 'OUTRO'];
const EMPTY = { amount: '', source: 'DIARIA' };

export function ReceitasSection() {
  const [items, setItems] = useState<Income[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: Income[] }>('/incomes?pageSize=30')
      .then((r) => setItems(r.data))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function add() {
    setError('');
    const amountCents = reaisToCents(form.amount);
    if (!amountCents) return setError('Informe o valor.');
    try {
      await api('/incomes', {
        method: 'POST',
        body: JSON.stringify({ amountCents, source: form.source }),
      });
      setForm(EMPTY);
      load();
    } catch {
      setError('Receitas só podem ser lançadas no dia de hoje.');
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta receita? O saldo será ajustado.')) return;
    await api(`/incomes/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Nova receita (hoje)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Valor (R$)">
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="180"
            />
          </Field>
          <Field label="Origem">
            <Select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3">
          <PrimaryButton onClick={add}>Adicionar</PrimaryButton>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState text="Nenhuma receita registrada ainda." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-emerald-700">{centsToBRL(i.amountCents)}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {i.source}
                    {i.client ? ` · ${i.client.name}` : ''}
                  </span>
                </div>
                <DangerButton onClick={() => remove(i.id)}>Excluir</DangerButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
