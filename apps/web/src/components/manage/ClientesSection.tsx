'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, DangerButton, EmptyState, Field, GhostButton, Input, PrimaryButton } from './common';

interface Client {
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
}

const EMPTY = { name: '', phone: '', notes: '' };

export function ClientesSection() {
  const [items, setItems] = useState<Client[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Client[]>('/clients')
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (!form.name.trim()) return;
    const body = {
      name: form.name.trim(),
      phone: form.phone || undefined,
      notes: form.notes || undefined,
    };
    if (editing) await api(`/clients/${editing}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/clients', { method: 'POST', body: JSON.stringify(body) });
    setForm(EMPTY);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir este cliente?')) return;
    await api(`/clients/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Maria"
            />
          </Field>
          <Field label="Telefone (opcional)">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Observações (opcional)">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
        <EmptyState text="Nenhum cliente cadastrado." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.phone && <div className="text-sm text-slate-500">{c.phone}</div>}
                </div>
                <div className="flex gap-2">
                  <GhostButton
                    onClick={() => {
                      setEditing(c.id);
                      setForm({ name: c.name, phone: c.phone ?? '', notes: c.notes ?? '' });
                    }}
                  >
                    Editar
                  </GhostButton>
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
