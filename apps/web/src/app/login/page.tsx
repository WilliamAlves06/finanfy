'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, setTokens } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, name }),
        },
      );
      setTokens(tokens);
      router.replace('/chat');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tenta de novo?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-emerald-600">Finanfy</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Seu dinheiro organizado, conversando.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === 'register' && (
            <input
              className="w-full rounded-xl border border-slate-200 p-3 text-lg"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-xl border border-slate-200 p-3 text-lg"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 p-3 text-lg"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="w-full rounded-xl bg-emerald-600 p-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-emerald-700 underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tenho conta'}
        </button>
      </div>
    </main>
  );
}
