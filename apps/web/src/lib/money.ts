// Conversão dinheiro <-> centavos para os formulários (entrada em reais pt-BR).

export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "90,50" | "90.50" | "1.234,56" | "1000" → centavos. null se inválido. */
export function reaisToCents(input: string): number | null {
  const raw = input.trim().replace(/[^\d.,]/g, '');
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** centavos → "90,50" para preencher um input de edição. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
