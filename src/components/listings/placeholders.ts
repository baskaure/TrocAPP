import type { Listing } from '../../lib/supabase';

/**
 * Visuel par défaut d'une annonce sans photo, calculé à l'affichage (aucune URL tierce
 * n'est enregistrée en base). Icône Material + dégradé selon la catégorie / le type.
 */
const BY_CATEGORY: Record<string, { icon: string; gradient: string }> = {
  informatique: { icon: 'computer', gradient: 'from-primary/15 to-primary-container/50' },
  maison: { icon: 'home', gradient: 'from-secondary-container/40 to-surface-container-high' },
  services: { icon: 'handyman', gradient: 'from-primary/10 to-secondary-container/30' },
  sport: { icon: 'directions_bike', gradient: 'from-primary-container/60 to-surface-container' },
  arts: { icon: 'palette', gradient: 'from-secondary-container/50 to-primary-container/40' },
  education: { icon: 'school', gradient: 'from-primary-fixed to-surface-container-low' },
  mode: { icon: 'checkroom', gradient: 'from-secondary-fixed to-surface-container' },
  mobilier: { icon: 'chair', gradient: 'from-surface-container-high to-primary-container/40' },
};

export function listingPlaceholder(listing: Pick<Listing, 'type'> & { category?: { name?: string; slug?: string } | null }) {
  const slug = listing.category?.slug ?? listing.category?.name?.toLowerCase();
  if (slug && BY_CATEGORY[slug]) return BY_CATEGORY[slug];
  return listing.type === 'service'
    ? { icon: 'handshake', gradient: 'from-primary/15 to-primary-container/50' }
    : { icon: 'inventory_2', gradient: 'from-secondary-container/40 to-primary-container/40' };
}
