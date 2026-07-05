// Dinheiro SEMPRE em centavos (Int) — ver docs/04. Formatação só na borda.

/**
 * Converte um trecho de texto pt-BR em centavos.
 * Aceita: "180", "90,50", "90.50", "R$ 90", "90 reais", "1.234,56".
 * Retorna null se não encontrar um valor monetário.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input
    .toLowerCase()
    .replace(/r\$\s*/g, '')
    .replace(/\breais?\b/g, '')
    .trim();

  // captura o primeiro número (com milhar/decimal pt-BR ou en)
  const match = cleaned.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;

  let raw = match[0];

  if (raw.includes(',')) {
    // formato pt-BR: "." é milhar, "," é decimal
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "1.234" sem vírgula → milhar pt-BR
    raw = raw.replace(/\./g, '');
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Formata centavos como "R$ 1.234,56". */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
