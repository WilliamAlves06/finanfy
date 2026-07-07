'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { centsToInput, reaisToCents } from '@/lib/money';
import { Card, DangerButton, EmptyState, Field, GhostButton, Input, PrimaryButton } from './common';

interface Goal {
  id: string;
  name: string;
  targetCents: number;
  savedFormatted: string;
  targetFormatted: string;
  progress: number;
}

const EMPTY = { name: '', target: '', contribute: '' };

export function MetasSection() {
  const [items, setItems] = useState<Goal[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Goal[]>('/goals')
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    const targetCents = reaisToCents(form.target);
    if (!form.name.trim() || !targetCents) return;
    const body = { name: form.name.trim(), targetCents };
    if (editing) await api(`/goals/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/goals', { method: 'POST', body: JSON.stringify(body) });
    setForm(EMPTY);
    setEditing(null);
    load();
  }

  async function contribute(id: string) {
    const value = prompt('Quanto você quer aportar nesta meta? (ex.: 50)');
    if (!value) return;
    const amountCents = reaisToCents(value);
    if (!amountCents) return;
    await api(`/goals/${id}/contributions`, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta meta?')) return;
    await api(`/goals/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">{editing ? 'Editar meta' : 'Nova meta'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Celular novo"
            />
          </Field>
          <Field label="Objetivo (R$)">
            <Input
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder="1500"
            />
          </Field>
        </div>
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
        <EmptyState text="Nenhuma meta ainda. Que tal criar uma?" />
      ) : (
        <Card>
          <ul className="space-y-3">
            {items.map((g) => (
              <li key={g.id}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">🎯 {g.name}</span>
                  <div className="flex gap-2">
                    <GhostButton onClick={() => contribute(g.id)}>Aportar</GhostButton>
                    <GhostButton
                      onClick={() => {
                        setEditing(g.id);
                        setForm({
                          name: g.name,
                          target: centsToInput(g.targetCents),
                          contribute: '',
                        });
                      }}
                    >
                      Editar
                    </GhostButton>
                    <DangerButton onClick={() => remove(g.id)}>Excluir</DangerButton>
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {g.savedFormatted} de {g.targetFormatted}
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${Math.round(g.progress * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
