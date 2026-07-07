'use client';

import { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="rounded-lg border border-slate-200 p-2" />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="rounded-lg border border-slate-200 p-2" />;
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
    >
      {children}
    </button>
  );
}

export function EmptyState({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
      {text}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-5 shadow">{children}</div>;
}
