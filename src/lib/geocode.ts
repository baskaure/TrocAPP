/** Cache mémoire pour limiter les appels (usage raisonnable côté navigateur). */
const cityCache = new Map<string, { lat: number; lng: number }>();

function cacheKey(city: string, country?: string) {
  return `${city.trim().toLowerCase()}|${(country ?? '').trim().toLowerCase()}`;
}

async function geocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const first = data[0];
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Photon (Komoot) — souvent plus tolérant côté navigateur si Nominatim échoue. */
async function geocodePhoton(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=fr`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Résout une ville (et pays optionnel) en coordonnées (Nominatim puis Photon).
 */
export async function geocodeCity(
  city: string,
  country?: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const c = city.trim();
  if (!c) return null;

  const key = cacheKey(c, country ?? undefined);
  const hit = cityCache.get(key);
  if (hit) return hit;

  const q = [c, country?.trim()].filter(Boolean).join(', ');

  try {
    let coords = await geocodeNominatim(q);
    if (!coords) coords = await geocodePhoton(q);
    if (!coords) return null;
    cityCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}
