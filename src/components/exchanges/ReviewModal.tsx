import { useState, type FormEvent } from 'react';
import { supabase, errorMessage } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';
import { PageBackLink } from '../layout/PageBackLink';
import { checkContent } from '../../lib/moderation';

type ReviewModalExchange = {
  id: string;
  contract?: {
    proposal?: {
      from_user_id?: string;
      to_user_id?: string;
      from_user?: { id?: string; display_name?: string; avatar_url?: string | null } | null;
      to_user?: { id?: string; display_name?: string; avatar_url?: string | null } | null;
    } | null;
  } | null;
};

type ReviewModalProps = {
  exchange: ReviewModalExchange;
  onClose: () => void;
  onSuccess: () => void;
};

const REVIEW_TAGS = ['Ponctuel', 'Qualité excellente', 'Bonne communication', 'Professionnel', 'Sympathique', 'Fiable', 'Rapide', 'Soigné'];

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
  const revieweeId = proposal?.from_user_id === user?.id ? proposal?.to_user_id : proposal?.from_user_id;
  const reviewee = proposal?.from_user_id === user?.id ? proposal?.to_user : proposal?.from_user;
  const revieweeName = reviewee?.display_name ?? 'votre partenaire';

  const displayRating = hoveredRating || rating;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) return setError('Veuillez donner une note');
    if (!user?.id || !revieweeId) return setError('Session ou destinataire invalide.');

    setLoading(true);
    setError('');
    try {
      const text = comment.trim();
      if (text) {
        const moderation = await checkContent(text, user.id);
        if (moderation.hasBlock) {
          setError(`Votre commentaire contient un terme interdit (${moderation.blockWords.join(', ')}).`);
          return;
        }
      }
      const { error: reviewError } = await supabase.from('reviews').insert({
        exchange_id: exchange.id,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: text || null,
        tags: selectedTags,
      });
      if (reviewError) throw reviewError;

      // La note moyenne est recalculée par le serveur (trigger sur reviews).
      void sendTransactionalEmail('new_review', revieweeId, {
        reviewer_name: user.display_name,
        rating: rating.toString(),
        exchange_id: exchange.id,
      });

      setSuccess(true);
      window.setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      setError(errorMessage(err, "Erreur lors de l'envoi de l'avis"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex w-full justify-center py-12">
        <div role="status" className="w-full max-w-md rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center shadow-soft-lg">
          <span className="material-symbols-outlined mx-auto mb-4 block text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
            check_circle
          </span>
          <h2 className="mb-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Merci pour votre avis !</h2>
          <p className="text-sm text-on-surface-variant">Il est publié sur le profil de {revieweeName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      <div className="relative w-full max-w-4xl">
        <PageBackLink onClick={onClose} label="Retour aux échanges" />

        <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg md:p-12">
          <div className="mb-10 text-center md:text-left">
            <span className="mb-4 inline-block rounded-full bg-primary-fixed px-4 py-1.5 font-headline text-xs font-bold uppercase tracking-widest text-on-primary-fixed">Laissez un avis</span>
            <h1 className="font-headline text-2xl font-black leading-tight tracking-tight text-on-surface sm:text-3xl md:text-4xl">
              Comment s&apos;est passé votre échange avec <span className="text-primary">{revieweeName}</span> ?
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            {error ? (
              <div role="alert" className="mb-6 rounded-xl border border-error-container bg-error-container/25 p-4 text-sm text-on-error-container">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              <div className="flex flex-col items-center lg:col-span-5 lg:items-start">
                <div className="mb-8 h-32 w-32 rotate-3 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/60">
                  {reviewee?.avatar_url ? (
                    <img src={reviewee.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-container-high font-headline text-3xl font-bold text-primary" aria-hidden>
                      {revieweeName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <h2 className="mb-2 font-headline text-xl font-bold tracking-tight text-on-surface">Note globale</h2>
                <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Note sur 5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= displayRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="min-h-11 min-w-11 transition-transform hover:scale-110 active:scale-95"
                        aria-label={`${star} sur 5`}
                      >
                        <span
                          className={`material-symbols-outlined text-4xl ${active ? 'text-secondary-fixed-dim' : 'text-surface-container-highest'}`}
                          style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
                          aria-hidden
                        >
                          star
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-sm font-medium text-on-surface-variant lg:text-left">Cliquez sur les étoiles pour évaluer l’échange dans son ensemble.</p>
                {rating > 0 ? <p className="mt-2 font-headline text-lg font-bold text-primary">{rating}/5</p> : null}
              </div>

              <div className="flex flex-col gap-8 lg:col-span-7">
                <fieldset>
                  <legend className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">Points forts de l&apos;échange</legend>
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_TAGS.map((tag) => {
                      const on = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleTag(tag)}
                          className={`min-h-10 rounded-full px-4 py-2 font-headline text-sm font-semibold transition-colors ${
                            on ? 'border-2 border-primary/20 bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-low text-on-surface hover:bg-primary-fixed hover:text-on-primary-fixed'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="review-comment" className="mb-4 block text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                    Votre commentaire (optionnel)
                  </label>
                  <div className="rounded-lg bg-surface-container-low p-1 transition-all focus-within:ring-2 focus-within:ring-primary/30">
                    <textarea
                      id="review-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      maxLength={1500}
                      className="w-full resize-none border-none bg-transparent p-4 font-inter text-on-surface placeholder:text-outline focus:ring-0"
                      placeholder="Dites-en plus sur votre expérience…"
                    />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">Votre avis sera visible sur le profil de {revieweeName}.</p>
                </div>

                <div className="flex flex-col gap-4 pt-4 sm:flex-row">
                  <button
                    type="submit"
                    disabled={loading || rating === 0}
                    className="min-h-12 flex-1 rounded-full bg-primary px-8 py-4 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Publication…' : "Publier l'avis"}
                  </button>
                  <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-full bg-surface-container-high py-4 font-headline text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest">
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
