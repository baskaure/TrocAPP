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

      console.log('Reviews loaded:', reviewsData, 'Error:', reviewsError);
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
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
    <div className="w-full max-w-4xl">
      <PageBackLink onClick={onBack} label={backLabel} />

      <div className="bg-white rounded-3xl shadow-soft-lg overflow-hidden border border-gray-100">
        {/* Banner */}
        {user.banner_url && (
          <div className="h-32 md:h-40">
            <img src={user.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-4 md:px-6 py-6">
          {/* Avatar & Name */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-24 h-24 rounded-full border-4 border-gray-100 shadow-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 bg-brand-yellow text-white rounded-full border-4 border-gray-100 shadow-lg flex items-center justify-center text-3xl font-bold flex-shrink-0">
                {user.display_name[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-heading font-semibold text-brand-text">{user.display_name}</h1>
              <p className="text-gray-500">@{user.username}</p>
              <div className="flex items-center justify-center sm:justify-start gap-1 mt-1 text-sm">
                {reviews.length > 0 ? (
                  <>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                    <span className="text-gray-500">({reviews.length} avis)</span>
                  </>
                ) : (
                  <span className="text-gray-400">Pas encore d'avis</span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-gray-700 mb-6">{user.bio}</p>
          )}

          {/* Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            {(user.city || user.country) && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{[user.city, user.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Languages & Skills */}
          {user.languages && user.languages.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Langues</h3>
              <div className="flex flex-wrap gap-2">
                {user.languages.map((lang) => (
                  <span key={lang} className="px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-sm">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.skills && user.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Compétences</h3>
              <div className="flex flex-wrap gap-2">
                {user.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-2xl text-center">
              <div className="text-2xl font-heading font-semibold text-brand-blue">{listings.length}</div>
              <div className="text-sm text-gray-600">Annonces</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl text-center">
              <div className="text-2xl font-heading font-semibold text-brand-blue">{reviews.length || '-'}</div>
              <div className="text-sm text-gray-600">Avis</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl text-center">
              <div className="text-2xl font-heading font-semibold text-brand-blue flex items-center justify-center gap-1">
                {reviews.length > 0 ? (
                  <>
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span>{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                  </>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div className="text-sm text-gray-600">Note</div>
            </div>
          </div>

          {/* Listings */}
          {listings.length > 0 && (
            <div className="border-t pt-6 mb-6">
              <h3 className="font-semibold mb-4">Annonces de {user.display_name} ({listings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => onViewListing?.(listing)}
                    className="bg-gray-50 rounded-2xl p-4 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {listing.media && listing.media[0] ? (
                        <img
                          src={listing.media[0].url}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-xs font-medium text-white ${
                          listing.type === 'service' ? 'bg-brand-blue' : 'bg-brand-yellow text-brand-text'
                        }`}>
                          {listing.type === 'service' ? 'Service' : 'Produit'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-2">{listing.title}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{listing.description_offer}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Avis reçus ({reviews.length})</h3>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun avis pour le moment</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-gray-50 rounded-lg p-4">
                    <div 
                      className={`flex items-start gap-3 ${onUserClick && review.reviewer?.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      onClick={() => {
                        if (onUserClick && review.reviewer?.id) {
                          onUserClick(review.reviewer.id);
                        }
                      }}
                    >
                      {review.reviewer?.avatar_url ? (
                        <img
                          src={review.reviewer.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-brand-yellow text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${onUserClick && review.reviewer?.id ? 'hover:text-brand-blue transition-colors' : ''}`}>{review.reviewer?.display_name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-gray-700 mt-2">{review.comment}</p>
                        )}
                        {review.tags && review.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {review.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
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

