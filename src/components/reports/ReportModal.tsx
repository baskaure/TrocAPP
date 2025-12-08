import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'listing' | 'user' | 'proposal' | 'chat';
  targetId: string;
  targetUserId?: string;
};

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'inappropriate', label: 'Contenu inapproprié' },
  { value: 'fraud', label: 'Arnaque ou fraude' },
  { value: 'harassment', label: 'Harcèlement' },
  { value: 'fake', label: 'Faux profil ou annonce' },
  { value: 'other', label: 'Autre' },
];

export function ReportModal({ isOpen, onClose, targetType, targetId, targetUserId }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason) return;

    setLoading(true);
    setError('');

    try {
      const reportData: Record<string, string | undefined> = {
        reporter_id: user.id,
        reason,
        details: details || undefined,
      };

      if (targetUserId) {
        reportData.reported_user_id = targetUserId;
      }

      if (targetType === 'listing') {
        reportData.listing_id = targetId;
      } else if (targetType === 'proposal') {
        reportData.proposal_id = targetId;
      } else if (targetType === 'chat') {
        reportData.chat_id = targetId;
      } else if (targetType === 'user') {
        reportData.reported_user_id = targetId;
      }

      const { error: insertError } = await supabase
        .from('reports')
        .insert(reportData);

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting report:', err);
      setError(err.message || 'Erreur lors de l\'envoi du signalement');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (targetType) {
      case 'listing': return 'Signaler cette annonce';
      case 'user': return 'Signaler cet utilisateur';
      case 'proposal': return 'Signaler cette proposition';
      case 'chat': return 'Signaler cette conversation';
      default: return 'Signaler';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-soft-lg border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{getTitle()}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-green-600 font-medium">Signalement envoyé !</p>
            <p className="text-gray-500 text-sm mt-1">Merci pour votre vigilance</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motif du signalement *
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="text-brand-blue"
                    />
                  <span className="text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Détails (optionnel)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                placeholder="Décrivez le problème..."
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!reason || loading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Signaler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

