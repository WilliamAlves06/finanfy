// Datas do domínio no fuso do usuário (America/Sao_Paulo) — regra sem-retroativo.

export function todayISO(timeZone = 'America/Sao_Paulo', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Data @db.Date de hoje no fuso (armazenada como meia-noite UTC). */
export function todayAsDate(timeZone = 'America/Sao_Paulo', now: Date = new Date()): Date {
  return new Date(`${todayISO(timeZone, now)}T00:00:00.000Z`);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
