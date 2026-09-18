import { SUPABASE_URL } from './supabase';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type PreparedImage = { blob: Blob; ext: 'webp' | 'jpg'; contentType: 'image/webp' | 'image/jpeg' };

async function sniffType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'image/webp';
  return null;
}

/**
 * Vérifie (type réel, taille) puis redimensionne une image côté navigateur avant envoi :
 * les photos de smartphone de 5 à 10 Mo deviennent des WebP de quelques centaines de Ko.
 */
export async function prepareImage(file: File, maxSize = 1600, quality = 0.82): Promise<PreparedImage> {
  if (file.size > IMAGE_MAX_BYTES) throw new Error('Image trop lourde (10 Mo maximum).');
  const realType = await sniffType(file);
  if (!realType || !ALLOWED_TYPES.has(realType)) throw new Error('Format non pris en charge : utilisez une image JPEG, PNG ou WebP.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    throw new Error('Impossible de lire cette image.');
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Traitement d’image indisponible dans ce navigateur.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, q));

  const webp = await toBlob('image/webp', quality);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp', contentType: 'image/webp' };
  const jpeg = await toBlob('image/jpeg', quality);
  if (!jpeg) throw new Error('Échec de la compression de l’image.');
  return { blob: jpeg, ext: 'jpg', contentType: 'image/jpeg' };
}

/** Chemin d'un objet dans un bucket public à partir de son URL publique (pour la suppression). */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length).split('?')[0]);
  } catch {
    return null;
  }
}
