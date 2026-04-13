import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';

type ReviewModalExchange = {
  id: string;
  contract?: {
    proposal?: {
      from_user_id?: string;
      to_user_id?: string;
      from_user?: { display_name?: string; email?: string; avatar_url?: string };
      to_user?: { display_name?: string; email?: string; avatar_url?: string };
    };
  };
};

type ReviewModalProps = {
  exchange: ReviewModalExchange;
  onClose: () => void;
  onSuccess: () => void;
};

const REVIEW_TAGS = [
  'Ponctuel',
  'Qualité excellente',
  'Bonne communication',
  'Professionnel',
  'Sympathique',
  'Fiable',
  'Rapide',
  'Soigné',
];

export function ReviewModal({ exchange, onClose, onSuccess }: ReviewModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const proposal = exchange.contract?.proposal;
  const revieweeId =
    proposal?.from_user_id === user?.id ? proposal?.to_user_id : proposal?.from_user_id;
  const reviewee =
    proposal?.from_user_id === user?.id ? proposal?.to_user : proposal?.from_user;
  const revieweeName = reviewee?.display_name ?? 'votre partenaire';
  const revieweeEmail = reviewee?.email;

  const displayRating = hoveredRating || rating;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError('Veuillez donner une note');
      return;
    }
    if (!user?.id || !revieweeId) {
      setError('Session ou destinataire invalide.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        exchange_id: exchange.id,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
        tags: selectedTags,
      });

      if (reviewError) throw reviewError;

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', revieweeId);

      if (existingReviews?.length) {
        const totalRating = existingReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / existingReviews.length;
        await supabase
          .from('users')
          .update({
            rating_avg: avgRating,
            rating_count: existingReviews.length,
          })
          .eq('id', revieweeId);
      }

      if (revieweeEmail) {
        sendTransactionalEmail('new_review', revieweeEmail, {
          reviewer_name: user.display_name,
          rating: rating.toString(),
          exchange_id: exchange.id,
        });
      }

      setSuccess(true);
      window.setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'avis");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
        <div className="glass-panel w-full max-w-md rounded-xl border border-white/40 p-10 text-center shadow-[0_20px_40px_rgba(25,28,29,0.08)] dark:border-white/10">
          <span
            className="material-symbols-outlined mx-auto mb-4 block text-6xl text-green-600 dark:text-green-400"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h2 className="mb-2 font-headline text-2xl font-extrabold text-on-surface">Merci pour votre avis !</h2>
          <p className="text-sm text-on-surface-variant">
            Votre retour a été publié et aide la communauté BonTroc.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface shadow-sm transition-colors hover:bg-white dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-800 sm:right-4 sm:top-4"
          aria-label="Fermer"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="absolute -left-12 -top-12 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 -z-10 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

        <section className="glass-panel mt-8 rounded-xl border border-white/40 p-8 shadow-[0_20px_40px_rgba(25,28,29,0.06)] dark:border-white/10 md:mt-0 md:p-12">
          <div className="mb-10 text-center md:text-left">
            <span className="mb-4 inline-block rounded-full bg-primary-fixed px-4 py-1.5 font-headline text-xs font-bold uppercase tracking-widest text-on-primary-fixed dark:bg-primary/25 dark:text-primary-fixed">
              Laissez un avis
            </span>
            <h1 className="font-headline text-4xl font-extrabold leading-tight tracking-tight text-on-surface md:text-5xl">
              Comment s&apos;est passé votre échange avec{' '}
              <span className="text-primary">{revieweeName}</span> ?
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            {error ? (
              <div className="mb-6 rounded-xl border border-error-container bg-error-container/25 p-4 text-sm text-on-error-container">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              <div className="flex flex-col items-center lg:col-span-5 lg:items-start">
                <div className="mb-8 h-32 w-32 rotate-3 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/60 dark:ring-slate-700">
                  {reviewee?.avatar_url ? (
                    <img src={reviewee.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-container-high font-headline text-3xl font-bold text-primary">
                      {revieweeName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <h2 className="mb-2 text-xl font-bold text-on-surface">Note globale</h2>
                <div className="mb-4 flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= displayRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                        aria-label={`${star} sur 5`}
                      >
                        <span
                          className={`material-symbols-outlined text-4xl ${
                            active ? 'text-secondary-fixed-dim dark:text-amber-400' : 'text-surface-container-highest dark:text-slate-600'
                          }`}
                          style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
                        >
                          star
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-sm font-medium text-on-surface-variant lg:text-left">
                  Cliquez sur les étoiles pour évaluer la prestation globale de votre partenaire.
                </p>
                {rating > 0 ? (
                  <p className="mt-2 font-headline text-lg font-bold text-primary">{rating}/5</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-8 lg:col-span-7">
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                    Points forts de l&apos;échange
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_TAGS.map((tag) => {
                      const on = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full px-4 py-2 font-headline text-sm font-semibold transition-colors ${
                            on
                              ? 'border-2 border-primary/20 bg-primary-fixed text-on-primary-fixed dark:border-primary/40 dark:bg-primary/25 dark:text-primary-fixed'
                              : 'bg-surface-container-low text-on-surface hover:bg-primary-fixed hover:text-on-primary-fixed dark:bg-slate-800 dark:hover:bg-primary/20 dark:hover:text-primary-fixed'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                    Votre commentaire (optionnel)
                  </h3>
                  <div className="rounded-lg bg-surface-container-low p-1 transition-all focus-within:ring-2 focus-within:ring-primary/30 dark:bg-slate-800/80">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      className="w-full resize-none border-none bg-transparent p-4 font-inter text-on-surface placeholder:text-outline focus:ring-0"
                      placeholder="Dites-en plus sur votre expérience..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Votre avis sera visible sur le profil de {revieweeName}.
                  </p>
                </div>

                <div className="flex flex-col gap-4 pt-4 sm:flex-row">
                  <button
                    type="submit"
                    disabled={loading || rating === 0}
                    className="flex-1 rounded-full bg-primary px-8 py-4 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Publication…' : "Publier l'avis"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-full bg-surface-container-high py-4 font-headline text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
