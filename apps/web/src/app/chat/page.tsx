'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getTokens, setTokens } from '@/lib/api';

interface Msg {
  role: 'USER' | 'ASSISTANT';
  content: string;
  quickReplies?: string[];
}

interface Summary {
  balanceFormatted: string;
  reserveFormatted: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshSummary = useCallback(() => {
    api<Summary>('/reports/summary')
      .then(setSummary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login');
      return;
    }
    refreshSummary();
    api<{ role: 'USER' | 'ASSISTANT'; content: string }[]>('/chat/messages')
      .then((history) => {
        if (history.length === 0) {
          setMessages([
            {
              role: 'ASSISTANT',
              content:
                'Oi! Eu sou o Fin. 🙂 Me conta: quanto você ganhou hoje? Ou pergunte "quanto tenho?"',
            },
          ]);
        } else {
          setMessages(history.map((m) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => {});
  }, [router, refreshSummary]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput('');
    setMessages((m) => [...m, { role: 'USER', content: text }]);
    try {
      const reply = await api<{ text: string; quickReplies?: string[] }>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((m) => [
        ...m,
        { role: 'ASSISTANT', content: reply.text, quickReplies: reply.quickReplies },
      ]);
      refreshSummary();
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'ASSISTANT', content: 'Ops, não consegui responder. Tenta de novo?' },
      ]);
    } finally {
      setSending(false);
    }
  }

  const lastQuickReplies =
    messages.length > 0 ? messages[messages.length - 1]?.quickReplies : undefined;

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
        <div>
          <span className="font-bold text-emerald-600">Finanfy</span>
          {summary && (
            <span className="ml-3 text-sm text-slate-600">
              Saldo <b>{summary.balanceFormatted}</b> · Caixinha <b>{summary.reserveFormatted}</b>
            </span>
          )}
        </div>
        <nav className="flex gap-3 text-sm">
          <Link className="text-emerald-700 underline" href="/dashboard">
            Painel
          </Link>
          <button
            className="text-slate-500 underline"
            onClick={() => {
              setTokens(null);
              router.replace('/login');
            }}
          >
            Sair
          </button>
        </nav>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'USER' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'USER'
                  ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-white'
                  : 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-4 py-2 shadow'
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="text-sm text-slate-400">Fin está digitando…</div>}
        <div ref={bottomRef} />
      </div>

      {lastQuickReplies && lastQuickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {lastQuickReplies.map((qr) => (
            <button
              key={qr}
              className="rounded-full border border-emerald-600 px-4 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
              onClick={() => send(qr)}
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-slate-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="flex-1 rounded-xl border border-slate-200 p-3 text-lg"
          placeholder='Ex.: "ganhei 180" ou "saldo"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          disabled={sending}
        >
          ➤
        </button>
      </form>
    </main>
  );
}
