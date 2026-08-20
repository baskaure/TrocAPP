import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ReportTarget = {
  targetType: 'listing' | 'user' | 'proposal' | 'chat';
  targetId: string;
  targetUserId?: string;
};

type ReportFormPanelProps = ReportTarget & {
  onDismiss: () => void;
};

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'inappropriate', label: 'Contenu inapproprié' },
  { value: 'fraud', label: 'Arnaque ou fraude' },
  { value: 'harassment', label: 'Harcèlement' },
  { value: 'fake', label: 'Faux profil ou annonce' },
  { value: 'other', label: 'Autre' },
];

/** Formulaire de signalement (page / panneau inline, sans overlay). */
export function ReportFormPanel({ targetType, targetId, targetUserId, onDismiss }: ReportFormPanelProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const getTitle = () => {
    switch (targetType) {
      case 'listing':
        return 'Signaler cette annonce';
      case 'user':
        return 'Signaler cet utilisateur';
      case 'proposal':
        return 'Signaler cette proposition';
      case 'chat':
        return 'Signaler cette conversation';
      default:
        return 'Signaler';
    }
  };

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

      const { error: insertError } = await supabase.from('reports').insert(reportData);

      if (insertError) throw insertError;

      setSuccess(true);
      window.setTimeout(() => {
        onDismiss();
        setSuccess(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (err: unknown) {
      console.error('Error submitting report:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : "Erreur lors de l'envoi du signalement";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2 text-error">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">{getTitle()}</h2>
      </div>

      {success ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <AlertTriangle className="h-8 w-8 text-green-700 dark:text-green-400" />
          </div>
          <p className="font-medium text-green-700 dark:text-green-400">Signalement envoyé !</p>
          <p className="mt-1 text-sm text-on-surface-variant">Merci pour votre vigilance</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">Motif du signalement *</label>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-primary"
                  />
                  <span className="text-on-surface">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface-variant">Détails (optionnel)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
              placeholder="Décrivez le problème..."
            />
          </div>

          {error ? <p className="text-sm text-error">{error}</p> : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!reason || loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-error px-4 py-2 text-sm font-semibold text-on-error disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Signaler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
