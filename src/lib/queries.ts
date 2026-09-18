/** Sélections PostgREST partagées : uniquement des colonnes publiques pour les profils embarqués. */
export const PUBLIC_PROFILE_COLS = 'id, display_name, username, avatar_url, city, country, is_verified, rating_avg, rating_count, status, profile_visibility';

export const LISTING_SELECT = `
  id, user_id, type, title, description_offer, desired_exchange_desc, category_id, mode,
  location_lat, location_lng, status, view_count, created_at, updated_at,
  user:public_profiles(${PUBLIC_PROFILE_COLS}),
  media:listing_media(id, listing_id, url, type, sort_order),
  category:categories(name, slug)
`;

export const PROPOSAL_SELECT = `
  *,
  from_user:public_profiles!proposals_from_user_id_fkey(*),
  to_user:public_profiles!proposals_to_user_id_fkey(*),
  listing:listings(id, user_id, type, title, description_offer, desired_exchange_desc, mode, status, created_at, updated_at, view_count,
    media:listing_media(id, listing_id, url, type, sort_order), category:categories(name, slug))
`;
