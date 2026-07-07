'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { centsToBRL, reaisToCents } from '@/lib/money';
import { Card, Field, GhostButton, Input, PrimaryButton } from './common';

interface Balance {
  balanceCents: number;
  balanceFormatted: string;
}
interface Movement {
  id: string;
  type: 'IN' | 'OUT';
  amountCents: number;
  reason?: string | null;
}

export function CaixinhaSection() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Balance>('/reserve')
      .then(setBalance)
      .catch(() => {});
    api<Movement[]>('/reserve/movements')
      .then(setMovements)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function deposit() {
    setError('');
    const amountCents = reaisToCents(amount);
    if (!amountCents) return setError('Informe o valor.');
    await api('/reserve/deposit', { method: 'POST', body: JSON.stringify({ amountCents }) });
    setAmount('');
    load();
  }

  async function withdraw() {
    setError('');
    const amountCents = reaisToCents(amount);
    if (!amountCents) return setError('Informe o valor.');
    try {
      await api('/reserve/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amountCents, destination: 'APENAS' }),
      });
      setAmount('');
      load();
    } catch {
      setError('Saldo insuficiente na caixinha.');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm text-slate-500">Você tem guardado</div>
        <div className="text-3xl font-bold text-blue-600">{balance?.balanceFormatted ?? '—'}</div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Valor (R$)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          </Field>
          <PrimaryButton onClick={deposit}>Guardar</PrimaryButton>
          <GhostButton onClick={withdraw}>Retirar</GhostButton>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <h3 className="font-semibold">Movimentações</h3>
        {movements.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma ainda.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {movements.map((m) => (
              <li key={m.id} className="flex justify-between py-2 text-sm">
                <span>
                  {m.type === 'IN'
                    ? '⬆️ Guardado'
                    : `⬇️ Retirado${m.reason ? ` (${m.reason})` : ''}`}
                </span>
                <span className={m.type === 'IN' ? 'text-emerald-700' : 'text-red-700'}>
                  {m.type === 'IN' ? '+' : '−'}
                  {centsToBRL(m.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
