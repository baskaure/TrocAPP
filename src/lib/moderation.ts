import { supabase } from './supabase';

type BannedWord = { word: string; severity: 'warning' | 'block' };

export async function loadBannedWords(): Promise<BannedWord[]> {
  const { data, error } = await supabase
    .from('banned_words')
    .select('word, severity');

  if (error) {
    console.error('Erreur chargement banned_words', error);
    return [];
  }

  if (!data) return [];

  return data.map((row) => ({
    word: row.word.trim().toLowerCase(),
    severity: row.severity === 'block' ? 'block' : 'warning', // normalise : seul "block" bloque
  }));
}

export async function checkContent(content: string, userId?: string): Promise<{
  hasWarning: boolean;
  hasBlock: boolean;
  detectedWords: string[];
  warningWords: string[];
  blockWords: string[];
}> {
  const words = await loadBannedWords();
  const lowerContent = content.toLowerCase();
  
  const detected: { word: string; severity: string }[] = [];
  
  for (const { word, severity } of words) {
    if (lowerContent.includes(word.toLowerCase())) {
      detected.push({ word, severity });
    }
  }
  
  const detectedWords = detected.map(d => d.word);
  const warningWords = detected.filter(d => d.severity === 'warning').map(d => d.word);
  const blockWords = detected.filter(d => d.severity === 'block').map(d => d.word);
  const hasWarning = warningWords.length > 0;
  const hasBlock = blockWords.length > 0;
  
  // Log si détection et userId fourni
  if (detected.length > 0 && userId) {
    await supabase.from('moderation_logs').insert({
      user_id: userId,
      action_type: hasBlock ? 'blocked_content' : 'warning_content',
      content: content.substring(0, 500),
      detected_words: detectedWords,
    });
  }
  
  return { hasWarning, hasBlock, detectedWords, warningWords, blockWords };
}

