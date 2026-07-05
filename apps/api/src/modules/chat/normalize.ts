// Normalização pt-BR do chat (espelha packages/utils — docs/08).

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[!?.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "R$ 90,50" | "90 reais" | "1.234,56" → centavos. null se não achar valor. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input
    .toLowerCase()
    .replace(/r\$\s*/g, '')
    .replace(/\breais?\b/g, '')
    .trim();
  const match = cleaned.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;
  let raw = match[0];
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
