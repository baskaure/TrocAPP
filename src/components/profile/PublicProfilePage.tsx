import { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Loader2 } from 'lucide-react';
import { supabase, type PublicProfile, type Listing, type Review } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';
import { ReportFormPanel } from '../reports/ReportModal';
import { LISTING_SELECT } from '../../lib/queries';
import { listingPlaceholder } from '../listings/placeholders';

type PublicProfilePageProps = {
  userId: string;
  onBack: () => void;
  backLabel?: string;
  onViewListing?: (listing: Listing) => void;
  onUserClick?: (userId: string) => void;
};

function Stars({ value, size = 'text-lg' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex text-secondary-fixed-dim" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`material-symbols-outlined ${size}`} style={value >= s - 0.25 ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>
          star
        </span>
      ))}
    </span>
  );
}

export function PublicProfilePage({ userId, onBack, backLabel = 'Retour', onViewListing, onUserClick }: PublicProfilePageProps) {
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setShowReport(false);
    try {
      const [{ data: profileData }, { data: listingsData }, { data: reviewsData }] = await Promise.all([
        supabase.from('public_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('listings').select(LISTING_SELECT).eq('user_id', userId).eq('status', 'published').order('created_at', { ascending: false }).limit(50),
        supabase
          .from('reviews')
          .select(`*, reviewer:public_profiles!reviews_reviewer_id_fkey(id, display_name, avatar_url)`)
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      setProfile((profileData as PublicProfile) ?? null);
      setListings(((listingsData as unknown as Listing[]) ?? []).filter(Boolean));
      setReviews(((reviewsData as unknown as Review[]) ?? []).filter(Boolean));
    } catch (err) {
      console.error('Chargement du profil impossible :', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadProfile();
  }, [userId, loadProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Chargement">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile || profile.status === 'deleted') {
    return (
      <div className="w-full max-w-4xl">
        <PageBackLink onClick={onBack} label={backLabel} />
        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest py-20 text-center text-on-surface-variant shadow-soft-lg">
          {profile ? 'Ce compte a été supprimé.' : 'Membre introuvable.'}
        </div>
      </div>
    );
  }

  const isMe = me?.id === profile.id;
  const isPrivate = profile.profile_visibility === 'private' && !isMe;
  const rating = Number(profile.rating_avg ?? 0);
  const ratingCount = profile.rating_count ?? reviews.length;

  return (
    <div className="w-full max-w-5xl">
      <PageBackLink onClick={onBack} label={backLabel} />

      <article className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
        {profile.banner_url && !isPrivate ? (
          <div className="h-32 md:h-40">
            <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}

        <div className="px-4 py-6 sm:px-6 md:px-8">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-24 w-24 flex-shrink-0 rounded-full border-4 border-surface-container-lowest object-cover shadow-lg" />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-secondary-container text-3xl font-bold text-on-secondary-container shadow-lg" aria-hidden>
                {profile.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl md:text-4xl">{profile.display_name}</h1>
              {profile.username ? <p className="text-base font-medium text-primary md:text-lg">@{profile.username}</p> : null}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
                {profile.is_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-on-primary">
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
                      verified
                    </span>
                    Vérifié
                  </span>
                ) : null}
                {ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Stars value={rating} size="text-base" />
                    <span className="font-medium text-on-surface">{rating.toFixed(1)}</span>
                    <span className="text-on-surface-variant">({ratingCount} avis)</span>
                  </span>
                ) : (
                  <span className="text-on-surface-variant">Pas encore d&apos;avis</span>
                )}
              </div>
            </div>
            {me && !isMe ? (
              <button type="button" onClick={() => setShowReport((v) => !v)} className="btn-secondary min-h-10 text-xs">
                Signaler ce profil
              </button>
            ) : null}
          </div>

          {isPrivate ? (
            <p className="mb-6 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Ce membre a choisi un profil privé : seules ses annonces et ses avis sont visibles.</p>
          ) : null}

          {!isPrivate && profile.bio ? <p className="mb-6 whitespace-pre-line font-inter text-on-surface-variant">{profile.bio}</p> : null}

          <div className="mb-6 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            {profile.city || profile.country ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              <span>Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          {!isPrivate && profile.languages && profile.languages.length > 0 ? (
            <div className="mb-4">
              <h2 className="mb-2 text-sm font-medium text-on-surface-variant">Langues</h2>
              <ul className="flex flex-wrap gap-2">
                {profile.languages.map((lang) => (
                  <li key={lang} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    {lang}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!isPrivate && profile.skills && profile.skills.length > 0 ? (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-on-surface-variant">Compétences</h2>
              <ul className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <li key={skill} className="rounded-full bg-secondary-container/40 px-3 py-1 text-sm font-medium text-on-secondary-container">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <dd className="font-headline text-xl font-semibold text-primary sm:text-2xl">{listings.length}</dd>
              <dt className="text-xs text-on-surface-variant sm:text-sm">Annonces</dt>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <dd className="font-headline text-xl font-semibold text-primary sm:text-2xl">{ratingCount || '–'}</dd>
              <dt className="text-xs text-on-surface-variant sm:text-sm">Avis</dt>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3 text-center sm:p-4">
              <dd className="font-headline text-xl font-semibold text-primary sm:text-2xl">{ratingCount > 0 ? rating.toFixed(1) : '–'}</dd>
              <dt className="text-xs text-on-surface-variant sm:text-sm">Note</dt>
            </div>
          </dl>

          {showReport ? (
            <div className="mb-6">
              <ReportFormPanel targetType="user" targetId={profile.id} targetUserId={profile.id} onDismiss={() => setShowReport(false)} />
            </div>
          ) : null}

          {listings.length > 0 ? (
            <section className="mb-6 border-t border-outline-variant/20 pt-6" aria-labelledby="member-listings-title">
              <h2 id="member-listings-title" className="mb-4 font-headline text-base font-bold text-on-surface">
                Annonces de {profile.display_name} ({listings.length})
              </h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {listings.map((listing) => {
                  const ph = listingPlaceholder(listing);
                  return (
                    <li key={listing.id}>
                      <button type="button" onClick={() => onViewListing?.(listing)} className="w-full rounded-2xl bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container-high">
                        <div className="flex items-start gap-3">
                          {listing.media && listing.media[0] ? (
                            <img src={listing.media[0].url} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                          ) : (
                            <div className={`flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br ${ph.gradient}`} aria-hidden>
                              <span className="material-symbols-outlined text-primary/70">{ph.icon}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 font-medium text-on-surface">{listing.title}</p>
                            <p className="mt-1 line-clamp-1 text-sm text-on-surface-variant">{listing.description_offer}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="border-t border-outline-variant/20 pt-6" aria-labelledby="member-reviews-title">
            <h2 id="member-reviews-title" className="mb-4 font-headline text-base font-bold text-on-surface">
              Avis reçus ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-on-surface-variant">Aucun avis pour le moment</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => {
                  const reviewerId = review.reviewer?.id;
                  const clickable = Boolean(onUserClick && reviewerId);
                  return (
                    <li key={review.id} className="rounded-2xl bg-surface-container-low p-4">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => reviewerId && onUserClick?.(reviewerId)}
                          className={`flex items-center gap-3 text-left ${clickable ? 'cursor-pointer transition-opacity hover:opacity-80' : 'cursor-default'}`}
                        >
                          {review.reviewer?.avatar_url ? (
                            <img src={review.reviewer.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-sm font-medium text-on-secondary-container" aria-hidden>
                              {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <span className="font-medium text-on-surface">{review.reviewer?.display_name ?? 'Membre'}</span>
                        </button>
                        <div className="ml-auto flex items-center gap-0.5">
                          <Stars value={review.rating} size="text-base" />
                          <span className="sr-only">{review.rating} sur 5</span>
                        </div>
                      </div>
                      {review.comment ? <p className="mt-3 whitespace-pre-line text-on-surface-variant">{review.comment}</p> : null}
                      {review.tags && review.tags.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {review.tags.map((tag) => (
                            <li key={tag} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                              {tag}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-xs text-on-surface-variant">{new Date(review.created_at).toLocaleDateString('fr-FR')}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
