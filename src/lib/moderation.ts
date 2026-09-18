import { supabase } from './supabase';

type BannedWord = { word: string; severity: 'warning' | 'block' };

let cache: { words: BannedWord[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

/** Minuscules sans accents, pour comparer « réputé » et « repute » de la même façon. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function loadBannedWords(): Promise<BannedWord[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.words;
  const { data, error } = await supabase.from('banned_words').select('word, severity');
  if (error || !data) {
    if (error) console.warn('Liste des mots interdits indisponible', error.message);
    return cache?.words ?? [];
  }
  const words = data
    .map((row) => ({
      word: normalizeText(String(row.word ?? '').trim()),
      severity: (row.severity === 'block' ? 'block' : 'warning') as BannedWord['severity'],
    }))
    .filter((w) => w.word.length > 0);
  cache = { words, loadedAt: Date.now() };
  return words;
}

/**
 * Détecte les termes interdits en respectant les frontières de mots (« calcul » ne déclenche
 * pas « cul »). Le serveur applique la même règle pour les termes bloquants ; ici on prévient
 * l'utilisateur avant l'envoi et on journalise les incidents.
 */
export async function checkContent(
  content: string,
  userId?: string,
): Promise<{
  hasWarning: boolean;
  hasBlock: boolean;
  detectedWords: string[];
  warningWords: string[];
  blockWords: string[];
}> {
  const words = await loadBannedWords();
  const haystack = normalizeText(content);
  const detected: BannedWord[] = [];

  for (const entry of words) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(entry.word)}(?=$|[^\\p{L}\\p{N}_])`, 'u');
    if (pattern.test(haystack)) detected.push(entry);
  }

  const detectedWords = detected.map((d) => d.word);
  const warningWords = detected.filter((d) => d.severity === 'warning').map((d) => d.word);
  const blockWords = detected.filter((d) => d.severity === 'block').map((d) => d.word);
  const hasWarning = warningWords.length > 0;
  const hasBlock = blockWords.length > 0;

  if (detected.length > 0 && userId) {
    void supabase.from('moderation_logs').insert({
      user_id: userId,
      action_type: hasBlock ? 'blocked_content' : 'warning_content',
      content: content.substring(0, 500),
      detected_words: detectedWords,
    });
  }

  return { hasWarning, hasBlock, detectedWords, warningWords, blockWords };
}
