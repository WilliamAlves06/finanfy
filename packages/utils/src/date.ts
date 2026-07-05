// Datas do domínio no fuso do usuário (padrão America/Sao_Paulo) — ver docs/04.

/** Retorna "YYYY-MM-DD" de hoje no fuso informado. */
export function todayInTz(timeZone = 'America/Sao_Paulo', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** True se a data (YYYY-MM-DD) é o dia de hoje no fuso — regra "sem retroativo" (UC-01). */
export function isToday(
  dateISO: string,
  timeZone = 'America/Sao_Paulo',
  now: Date = new Date(),
): boolean {
  return dateISO === todayInTz(timeZone, now);
}
