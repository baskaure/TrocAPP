import { supabase } from './supabase';

let bannedWordsCache: { word: string; severity: string }[] = [];
let cacheLoaded = false;

export async function loadBannedWords() {
  if (cacheLoaded) return bannedWordsCache;
  
  const { data } = await supabase
    .from('banned_words')
    .select('word, severity');
  
  if (data) {
    bannedWordsCache = data;
    cacheLoaded = true;
  }
  return bannedWordsCache;
}

export async function checkContent(content: string, userId?: string): Promise<{
  hasWarning: boolean;
  hasBlock: boolean;
  detectedWords: string[];
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
  const hasWarning = detected.some(d => d.severity === 'warning');
  const hasBlock = detected.some(d => d.severity === 'block');
  
  // Log si détection et userId fourni
  if (detected.length > 0 && userId) {
    await supabase.from('moderation_logs').insert({
      user_id: userId,
      action_type: hasBlock ? 'blocked_content' : 'warning_content',
      content: content.substring(0, 500),
      detected_words: detectedWords,
    });
  }
  
  return { hasWarning, hasBlock, detectedWords };
}

