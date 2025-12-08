import { useState } from 'react';
import { X, Star, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';

type ReviewModalProps = {
  exchange: any;
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
  const revieweeId = proposal?.from_user_id === user?.id
    ? proposal?.to_user_id
    : proposal?.from_user_id;
  const revieweeName = proposal?.from_user_id === user?.id
    ? proposal?.to_user?.display_name
    : proposal?.from_user?.display_name;
  const revieweeEmail = proposal?.from_user_id === user?.id
    ? proposal?.to_user?.email
    : proposal?.from_user?.email;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (rating === 0) {
      setError('Veuillez donner une note');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          exchange_id: exchange.id,
          reviewer_id: user?.id,
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

      if (existingReviews) {
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
          reviewer_name: user?.display_name,
          rating: rating.toString(),
          exchange_id: exchange.id,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi de l\'avis');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-soft-lg border border-gray-100">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-brand-text mb-2">
            Merci pour votre avis !
          </h2>
          <p className="text-gray-600 text-sm">
            Votre retour a été publié avec succès et aide la communauté BonTroc.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-soft-lg border border-gray-100">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl sm:text-2xl font-heading font-semibold text-brand-text">
            Laisser un avis
          </h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <p className="text-gray-600 mb-4 text-sm">
              Comment s'est passé votre échange avec <strong>{revieweeName}</strong> ?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Note globale *
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-brand-yellow text-brand-yellow'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-3 text-lg font-semibold text-brand-text">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points forts (optionnel)
            </label>
            <div className="flex flex-wrap gap-2">
              {REVIEW_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs sm:text-sm transition-colors border ${
                    selectedTags.includes(tag)
                      ? 'bg-brand-blue text-white border-brand-blue shadow-soft-lg'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-2xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white text-sm"
              placeholder="Partagez votre expérience avec la communauté..."
            />
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Votre avis sera visible publiquement sur le profil de {revieweeName}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full sm:flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="btn-primary w-full sm:flex-1 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi...' : 'Publier l\'avis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
