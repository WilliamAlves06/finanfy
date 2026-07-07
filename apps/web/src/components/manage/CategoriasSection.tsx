'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, DangerButton, Field, GhostButton, Input, PrimaryButton, Select } from './common';

interface CategoryItem {
  id: string;
  name: string;
  kind: string;
  isDefault: boolean;
}

const EMPTY = { name: '', kind: 'EXPENSE' };

export function CategoriasSection() {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<CategoryItem[]>('/categories')
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (!form.name.trim()) return;
    if (editing) {
      await api(`/categories/${editing}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim() }),
      });
    } else {
      await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), kind: form.kind }),
      });
    }
    setForm(EMPTY);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta categoria?')) return;
    await api(`/categories/${id}`, { method: 'DELETE' });
    load();
  }

  const mine = items.filter((c) => !c.isDefault);
  const defaults = items.filter((c) => c.isDefault);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">{editing ? 'Editar categoria' : 'Nova categoria'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Lazer"
            />
          </Field>
          {!editing && (
            <Field label="Tipo">
              <Select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
                <option value="BOTH">Ambos</option>
              </Select>
            </Field>
          )}
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

      <Card>
        <h3 className="font-semibold">Minhas categorias</h3>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Você ainda não criou categorias próprias.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {mine.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>{c.name}</span>
                <div className="flex gap-2">
                  <GhostButton
                    onClick={() => {
                      setEditing(c.id);
                      setForm({ name: c.name, kind: c.kind });
                    }}
                  >
                    Editar
                  </GhostButton>
                  <DangerButton onClick={() => remove(c.id)}>Excluir</DangerButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Padrão do sistema (não editáveis): {defaults.map((c) => c.name).join(', ')}
        </p>
      </Card>
    </div>
  );
}
