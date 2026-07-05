/**
 * Normalizacao de texto pt-BR para o motor de regras (docs/08):
 * minusculas, sem acento (NFD + remocao de diacriticos), espacos colapsados,
 * pontuacao de borda removida.
 */
// U+0300–U+036F = diacríticos combinantes (acentos soltos após NFD)
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
