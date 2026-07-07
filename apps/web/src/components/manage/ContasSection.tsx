'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { centsToBRL, centsToInput, reaisToCents } from '@/lib/money';
import { Card, DangerButton, EmptyState, Field, GhostButton, Input, PrimaryButton } from './common';

interface Bill {
  id: string;
  name: string;
  amountCents: number;
  dueDay: number;
}

const EMPTY = { name: '', amount: '', dueDay: '10' };

export function ContasSection() {
  const [items, setItems] = useState<Bill[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Bill[]>('/recurring-bills')
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    setError('');
    const amountCents = reaisToCents(form.amount);
    if (!form.name.trim() || !amountCents) return setError('Preencha nome e valor.');
    const body = { name: form.name.trim(), amountCents, dueDay: Number(form.dueDay) };
    if (editing)
      await api(`/recurring-bills/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/recurring-bills', { method: 'POST', body: JSON.stringify(body) });
    setForm(EMPTY);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta conta fixa? As cobranças já geradas ficam no histórico.')) return;
    await api(`/recurring-bills/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">{editing ? 'Editar conta fixa' : 'Nova conta fixa'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Internet"
            />
          </Field>
          <Field label="Valor (R$)">
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="156"
            />
          </Field>
          <Field label="Vence dia">
            <Input
              type="number"
              min={1}
              max={28}
              value={form.dueDay}
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
            />
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <PrimaryButton onClick={save}>{editing ? 'Salvar' : 'Adicionar'}</PrimaryButton>
          {editing && (
            <GhostButton
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              Cancelar
            </GhostButton>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Dica: no chat você pode cadastrar várias de uma vez (uma por linha: &quot;Internet
          156&quot;).
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState text="Nenhuma conta fixa cadastrada." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-sm text-slate-500">
                    {centsToBRL(b.amountCents)} · vence dia {b.dueDay}
                  </div>
                </div>
                <div className="flex gap-2">
                  <GhostButton
                    onClick={() => {
                      setEditing(b.id);
                      setForm({
                        name: b.name,
                        amount: centsToInput(b.amountCents),
                        dueDay: String(b.dueDay),
                      });
                    }}
                  >
                    Editar
                  </GhostButton>
                  <DangerButton onClick={() => remove(b.id)}>Excluir</DangerButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
