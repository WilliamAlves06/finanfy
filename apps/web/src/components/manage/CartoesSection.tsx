'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { reaisToCents, centsToInput } from '@/lib/money';
import { Card, DangerButton, EmptyState, Field, GhostButton, Input, PrimaryButton } from './common';

interface CardItem {
  id: string;
  name: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  availableFormatted: string;
}

const EMPTY = { name: '', limit: '', closingDay: '5', dueDay: '10' };

export function CartoesSection() {
  const [items, setItems] = useState<CardItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<CardItem[]>('/cards')
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    setError('');
    const limitCents = reaisToCents(form.limit);
    if (!form.name.trim() || !limitCents) return setError('Preencha nome e limite.');
    const body = {
      name: form.name.trim(),
      limitCents,
      closingDay: Number(form.closingDay),
      dueDay: Number(form.dueDay),
    };
    try {
      if (editing) await api(`/cards/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/cards', { method: 'POST', body: JSON.stringify(body) });
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch {
      setError('Não consegui salvar. Confira os dados.');
    }
  }

  function edit(c: CardItem) {
    setEditing(c.id);
    setForm({
      name: c.name,
      limit: centsToInput(c.limitCents),
      closingDay: String(c.closingDay),
      dueDay: String(c.dueDay),
    });
  }

  async function remove(id: string) {
    if (!confirm('Excluir este cartão?')) return;
    await api(`/cards/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">{editing ? 'Editar cartão' : 'Novo cartão'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nubank"
            />
          </Field>
          <Field label="Limite (R$)">
            <Input
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
              placeholder="1000"
            />
          </Field>
          <Field label="Dia de fechamento">
            <Input
              type="number"
              min={1}
              max={28}
              value={form.closingDay}
              onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
            />
          </Field>
          <Field label="Dia de vencimento">
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
      </Card>

      {items.length === 0 ? (
        <EmptyState text="Você ainda não tem cartões." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">💳 {c.name}</div>
                  <div className="text-sm text-slate-500">
                    Disponível {c.availableFormatted} · fecha dia {c.closingDay} · vence {c.dueDay}
                  </div>
                </div>
                <div className="flex gap-2">
                  <GhostButton onClick={() => edit(c)}>Editar</GhostButton>
                  <DangerButton onClick={() => remove(c.id)}>Excluir</DangerButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
