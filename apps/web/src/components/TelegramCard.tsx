'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Connection {
  connected: boolean;
  displayName?: string;
  username?: string;
  externalId?: string;
  connectedAt?: string;
}

/** Cartão de conexão do Telegram: mostra estado real e permite desvincular. */
export function TelegramCard() {
  const [conn, setConn] = useState<Connection | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Connection>('/channels/telegram/status')
      .then((c) => {
        setConn(c);
        if (c.connected) setCode(null); // conectou → some o código
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // enquanto há um código na tela, verifica a cada 4s se a pessoa já vinculou
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function generate() {
    setError('');
    setBusy(true);
    try {
      const r = await api<{ code: string }>('/channels/telegram/link-code');
      setCode(r.code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não consegui gerar o código.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!confirm('Desconectar este Telegram da sua conta?')) return;
    setBusy(true);
    try {
      await api('/channels/telegram', { method: 'DELETE' });
      setConn({ connected: false });
      setCode(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow">
      <h2 className="font-semibold">Telegram</h2>

      {conn?.connected ? (
        <div className="mt-2">
          <p className="font-medium text-emerald-600">Telegram conectado ✅</p>
          <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
            {conn.displayName && (
              <li>
                Nome: <b>{conn.displayName}</b>
              </li>
            )}
            {conn.username && (
              <li>
                Usuário: <b>@{conn.username}</b>
              </li>
            )}
            {conn.externalId && (
              <li>
                ID: <b>{conn.externalId}</b>
              </li>
            )}
            {conn.connectedAt && (
              <li>Conectado em {new Date(conn.connectedAt).toLocaleDateString('pt-BR')}</li>
            )}
          </ul>
          <button
            className="mt-3 rounded-xl border border-red-400 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={unlink}
            disabled={busy}
          >
            Desvincular Telegram
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-slate-500">
            Fale com o Fin pelo Telegram. Gere um código e mande <code>vincular CODIGO</code> para o{' '}
            <b>@finanfybot</b>.
          </p>
          {code ? (
            <div className="mt-3">
              <p className="text-3xl font-bold tracking-widest text-emerald-600">{code}</p>
              <p className="mt-1 text-sm text-slate-500">
                No Telegram, mande: <code>vincular {code}</code> — vale por 10 minutos. Aguardando…
                ⏳
              </p>
            </div>
          ) : (
            <button
              className="mt-3 rounded-xl border border-emerald-600 px-4 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              onClick={generate}
              disabled={busy}
            >
              Gerar código
            </button>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
