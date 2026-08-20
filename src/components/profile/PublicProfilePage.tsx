import { useState, useEffect } from 'react';
import { MapPin, Calendar, Star, Loader2 } from 'lucide-react';
import { supabase, User, Listing, Review } from '../../lib/supabase';
import { PageBackLink } from '../layout/PageBackLink';

type PublicProfilePageProps = {
  userId: string;
  onBack: () => void;
  /** Libellé du lien retour (ex. selon la page d’origine). */
  backLabel?: string;
  onViewListing?: (listing: Listing) => void;
  onUserClick?: (userId: string) => void;
};

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

export function PublicProfilePage({
  userId,
  onBack,
  backLabel = 'Retour',
  onViewListing,
  onUserClick,
}: PublicProfilePageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) setUser(userData);

      const { data: listingsData } = await supabase
        .from('listings')
        .select(`*, media:listing_media(*)`)
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (listingsData) setListings(listingsData);

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      if (reviewsError) {
        console.error('Erreur lors du chargement des avis:', reviewsError);
      }
      if (reviewsData) setReviews(reviewsData);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-4xl">
        <PageBackLink onClick={onBack} label={backLabel} />
        <div className="py-20 text-center text-on-surface-variant">Utilisateur non trouvé</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl">
      <PageBackLink onClick={onBack} label={backLabel} />

      <div className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
        {/* Banner */}
        {user.banner_url && (
          <div className="h-32 md:h-40">
            <img src={user.banner_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="px-4 py-6 sm:px-6 md:px-8">
          {/* Avatar & Name */}
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="h-24 w-24 flex-shrink-0 rounded-full border-4 border-surface-container-lowest object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-secondary-container text-3xl font-bold text-on-secondary-container shadow-lg">
                {user.display_name[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl md:text-4xl">
                {user.display_name}
              </h1>
              <p className="text-base font-medium text-primary md:text-lg">@{user.username}</p>
              <div className="mt-1 flex items-center justify-center gap-1 text-sm sm:justify-start">
                {reviews.length > 0 ? (
                  <>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-on-surface">
                      {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                    </span>
                    <span className="text-on-surface-variant">({reviews.length} avis)</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Pas encore d&apos;avis</span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="mb-6 font-inter text-on-surface-variant">{user.bio}</p>
          )}

          {/* Info */}
          <div className="mb-6 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            {(user.city || user.country) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{[user.city, user.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                Membre depuis{' '}
                {new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Languages & Skills */}
          {user.languages && user.languages.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-on-surface-variant">Langues</h3>
              <div className="flex flex-wrap gap-2">
                {user.languages.map((lang) => (
                  <span key={lang} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.skills && user.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-on-surface-variant">Compétences</h3>
              <div className="flex flex-wrap gap-2">
                {user.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-secondary-container/40 px-3 py-1 text-sm font-medium text-on-secondary-container">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <div className="font-headline text-xl font-semibold text-primary sm:text-2xl">{listings.length}</div>
              <div className="text-xs text-on-surface-variant sm:text-sm">Annonces</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <div className="font-headline text-xl font-semibold text-primary sm:text-2xl">{reviews.length || '-'}</div>
              <div className="text-xs text-on-surface-variant sm:text-sm">Avis</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <div className="flex items-center justify-center gap-1 font-headline text-xl font-semibold text-primary sm:text-2xl">
                {reviews.length > 0 ? (
                  <>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 sm:h-5 sm:w-5" />
                    <span>{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                  </>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div className="text-xs text-on-surface-variant sm:text-sm">Note</div>
            </div>
          </div>

          {/* Listings */}
          {listings.length > 0 && (
            <div className="mb-6 border-t border-outline-variant/20 pt-6">
              <h3 className="mb-4 font-headline text-base font-bold text-on-surface">
                Annonces de {user.display_name} ({listings.length})
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {listings.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => onViewListing?.(listing)}
                    className="rounded-2xl bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container-high"
                  >
                    <div className="flex items-start gap-3">
                      {listing.media && listing.media[0] ? (
                        <img
                          src={listing.media[0].url}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-lg text-xs font-medium ${
                            listing.type === 'service'
                              ? 'bg-primary text-on-primary'
                              : 'bg-secondary-container text-on-secondary-container'
                          }`}
                        >
                          {listing.type === 'service' ? 'Service' : 'Produit'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-medium text-on-surface">{listing.title}</p>
                        <p className="mt-1 line-clamp-1 text-sm text-on-surface-variant">{listing.description_offer}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="border-t border-outline-variant/20 pt-6">
            <h3 className="mb-4 font-headline text-base font-bold text-on-surface">
              Avis reçus ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-on-surface-variant">Aucun avis pour le moment</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl bg-surface-container-low p-4">
                    <div
                      role={onUserClick && review.reviewer?.id ? 'button' : undefined}
                      tabIndex={onUserClick && review.reviewer?.id ? 0 : undefined}
                      className={`flex items-start gap-3 ${
                        onUserClick && review.reviewer?.id ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
                      }`}
                      onClick={() => {
                        if (onUserClick && review.reviewer?.id) {
                          onUserClick(review.reviewer.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && onUserClick && review.reviewer?.id) {
                          e.preventDefault();
                          onUserClick(review.reviewer.id);
                        }
                      }}
                    >
                      {review.reviewer?.avatar_url ? (
                        <img src={review.reviewer.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-sm font-medium text-on-secondary-container">
                          {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium text-on-surface ${
                              onUserClick && review.reviewer?.id ? 'transition-colors hover:text-primary' : ''
                            }`}
                          >
                            {review.reviewer?.display_name}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-outline-variant'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && <p className="mt-2 text-on-surface-variant">{review.comment}</p>}
                        {review.tags && review.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {review.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-on-surface-variant">
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

