import { useMemo, useState, type FormEvent } from 'react';
import { supabase, errorMessage, type ExchangeStatus } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { checkContent } from '../../lib/moderation';
import { DISPUTE_STATUS_LABEL, formatDateFr } from '../../lib/labels';
import type { ExchangeWithDetails } from './ExchangesPage';

type ExchangeTrackerProps = {
  exchange: ExchangeWithDetails;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
  onOpenContract?: () => void;
};

const STEPS: { id: ExchangeStatus; label: string; icon: string }[] = [
  { id: 'not_started', label: 'Contrat', icon: 'history_edu' },
  { id: 'in_progress', label: 'En cours', icon: 'sync' },
  { id: 'delivered', label: 'Livré', icon: 'local_shipping' },
  { id: 'confirmed', label: 'Confirmé', icon: 'verified' },
];

function stepIndex(status: ExchangeStatus): number {
  if (status === 'cancelled') return -1;
  const i = STEPS.findIndex((s) => s.id === status);
  return i >= 0 ? i : 0;
}

export function ExchangeTracker({ exchange, onClose, onUpdate, onOpenContract }: ExchangeTrackerProps) {
  const { user } = useAuth();
  const { toast, confirm } = useNotice();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const proposal = exchange.contract?.proposal;
  const listing = proposal?.listing;
  const contractStatus = exchange.contract?.status;
  const heroImageUrl = listing?.media?.[0]?.url;
  const currentIdx = stepIndex(exchange.status);
  const isFromUser = proposal?.from_user_id === user?.id;
  const otherParty = isFromUser ? proposal?.to_user : proposal?.from_user;

  const openDispute = exchange.dispute && (exchange.dispute.status === 'open' || exchange.dispute.status === 'in_review');
  const contractSigned = contractStatus === 'active' || contractStatus === 'completed';

  const canStart = exchange.status === 'not_started' && contractSigned;
  const needsSignature = exchange.status === 'not_started' && !contractSigned;
  const canMarkAsDelivered = exchange.status === 'in_progress' && !openDispute;
  const canConfirm = exchange.status === 'delivered' && exchange.delivered_by !== user?.id && !openDispute;
  const canCancel = (exchange.status === 'not_started' || exchange.status === 'in_progress') && !openDispute;
  // Un litige clos n'empêche pas d'en ouvrir un nouveau (l'index unique ne vise que les litiges ouverts).
  const canOpenDispute = (exchange.status === 'delivered' || exchange.status === 'in_progress') && !openDispute;

  const statusBody = useMemo(() => {
    if (exchange.status === 'cancelled') return { title: 'Échange annulé', text: 'Cet échange a été annulé. Aucune action n’est possible depuis cette fiche.' };
    if (exchange.status === 'not_started') {
      return contractSigned
        ? { title: 'Prêt à démarrer', text: 'Le contrat est signé par les deux parties. Démarrez l’échange dès que vous commencez à honorer votre part.' }
        : { title: 'Contrat à signer', text: 'L’échange démarre une fois le contrat signé par les deux parties.' };
    }
    if (exchange.status === 'in_progress') return { title: 'Échange en cours', text: 'Quand vous avez remis votre part, marquez l’échange comme livré. L’autre partie confirmera la réception.' };
    if (exchange.status === 'delivered') {
      return {
        title: 'Livraison déclarée',
        text:
          exchange.delivered_by === user?.id
            ? 'Vous avez indiqué avoir livré votre part. En attente de confirmation par l’autre partie.'
            : `${otherParty?.display_name ?? 'L’autre partie'} indique avoir livré. Vérifiez, puis confirmez la réception si tout est conforme. En cas de problème, ouvrez un litige.`,
      };
    }
    if (exchange.status === 'confirmed') return { title: 'Échange terminé', text: 'La réception a été confirmée. Pensez à laisser un avis sur votre partenaire.' };
    return { title: 'Statut', text: '' };
  }, [exchange.status, exchange.delivered_by, user?.id, contractSigned, otherParty?.display_name]);

  async function transition(next: ExchangeStatus, successMessage: string) {
    setLoading(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase.from('exchanges').update({ status: next }).eq('id', exchange.id).select('id');
      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('Mise à jour refusée : l’échange a peut-être changé de statut.');
      toast.success(successMessage);
      await onUpdate();
    } catch (err) {
      setError(errorMessage(err, 'Mise à jour impossible'));
    } finally {
      setLoading(false);
    }
  }

  const handleStart = () => transition('in_progress', 'Échange démarré.');
  const handleDelivered = async () => {
    const ok = await confirm({ title: 'Marquer votre part comme livrée ?', description: 'L’autre partie sera invitée à confirmer la réception.', confirmLabel: 'Oui, c’est livré' });
    if (ok) await transition('delivered', 'Livraison déclarée.');
  };
  const handleConfirm = async () => {
    const ok = await confirm({ title: 'Confirmer la réception ?', description: 'Cette action clôture l’échange. Vous pourrez ensuite laisser un avis.', confirmLabel: 'Confirmer' });
    if (ok) await transition('confirmed', 'Échange confirmé. Merci !');
  };
  const handleCancel = async () => {
    const ok = await confirm({ title: 'Annuler cet échange ?', description: 'Le contrat sera annulé pour les deux parties.', confirmLabel: 'Annuler l’échange', danger: true });
    if (ok) await transition('cancelled', 'Échange annulé.');
  };

  async function handleOpenDispute(e: FormEvent) {
    e.preventDefault();
    if (!disputeReason.trim() || !user) return;
    setDisputeLoading(true);
    setDisputeError('');
    try {
      const reason = disputeReason.trim();
      const moderation = await checkContent(reason, user.id);
      if (moderation.hasBlock) {
        setDisputeError(`Le texte contient un terme interdit (${moderation.blockWords.join(', ')}).`);
        return;
      }
      const { error: disputeErr } = await supabase.from('disputes').insert({ exchange_id: exchange.id, opened_by: user.id, reason, status: 'open' });
      if (disputeErr) throw disputeErr;
      setShowDisputeForm(false);
      setDisputeReason('');
      toast.info('Litige ouvert. Notre équipe va l’examiner.');
      await onUpdate();
    } catch (err) {
      setDisputeError(errorMessage(err, "Impossible d'ouvrir un litige"));
    } finally {
      setDisputeLoading(false);
    }
  }

  const transactionRef = useMemo(() => {
    const y = new Date(exchange.created_at).getFullYear();
    const short = exchange.id.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `#BT-${y}-${short}`;
  }, [exchange.id, exchange.created_at]);

  const primary = canStart
    ? { label: "Démarrer l'échange", icon: 'play_arrow', action: handleStart }
    : needsSignature && onOpenContract
      ? { label: 'Signer le contrat', icon: 'history_edu', action: onOpenContract }
      : canMarkAsDelivered
        ? { label: 'Marquer comme livré', icon: 'local_shipping', action: handleDelivered }
        : canConfirm
          ? { label: 'Confirmer la réception', icon: 'verified', action: handleConfirm }
          : null;

  return (
    <div className="w-full pb-16">
      <PageBackLink onClick={onClose} label="Retour aux échanges" />
      <div className="relative w-full max-w-4xl overflow-x-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg" role="region" aria-labelledby="exchange-tracker-title">
        <div className="relative h-44 w-full overflow-hidden sm:h-48">
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-primary to-primary-container opacity-20 mix-blend-multiply" />
          {heroImageUrl ? (
            <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary-container/20 to-surface-container-high" />
          )}
          <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-12">
            <span className="mb-2 text-sm font-bold uppercase tracking-widest text-primary-fixed">Suivi de l’échange</span>
            <h1 id="exchange-tracker-title" className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
              {listing?.title ?? 'Échange'}
            </h1>
          </div>
        </div>

        <div className="p-6 md:p-12">
          {error ? (
            <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-error-container bg-error-container/30 p-4 text-sm text-on-error-container">
              <span className="material-symbols-outlined flex-shrink-0 text-[20px]" aria-hidden>
                error
              </span>
              <span>{error}</span>
            </div>
          ) : null}

          <ol className="relative mb-14 grid grid-cols-4 gap-2 sm:gap-4" aria-label="Étapes de l’échange">
            <div className="absolute left-[12.5%] right-[12.5%] top-6 z-0 h-0.5 bg-surface-container-high" aria-hidden />
            {STEPS.map((step, index) => {
              const cancelled = exchange.status === 'cancelled';
              const reached = !cancelled && index <= currentIdx;
              const isFuture = cancelled || index > currentIdx;
              return (
                <li key={step.id} className="relative z-10 flex flex-col items-center text-center" aria-current={index === currentIdx ? 'step' : undefined}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${reached ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 ring-4 ring-primary-fixed' : 'bg-surface-container-high text-on-surface-variant'} ${isFuture ? 'opacity-40' : ''}`}>
                    <span className="material-symbols-outlined text-[22px]" aria-hidden>
                      {step.icon}
                    </span>
                  </div>
                  <p className={`mt-3 text-xs sm:text-sm ${reached ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'} ${isFuture ? 'opacity-40' : ''}`}>{step.label}</p>
                </li>
              );
            })}
          </ol>

          <div className="grid items-center gap-8 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-6 md:grid-cols-12 md:p-8">
            <div className="md:col-span-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-secondary-container p-2">
                  <span className="material-symbols-outlined text-on-secondary-container" aria-hidden>
                    info
                  </span>
                </div>
                <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">{statusBody.title}</h2>
              </div>
              <p className="mb-4 text-lg leading-relaxed text-on-surface-variant">{statusBody.text}</p>
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-variant">
                {exchange.delivered_at ? (
                  <div>
                    <dt className="inline font-semibold">Livré le : </dt>
                    <dd className="inline">{formatDateFr(exchange.delivered_at)}</dd>
                  </div>
                ) : null}
                {exchange.confirmed_at ? (
                  <div>
                    <dt className="inline font-semibold">Confirmé le : </dt>
                    <dd className="inline">{formatDateFr(exchange.confirmed_at)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="flex flex-col gap-3 md:col-span-4">
              {primary ? (
                <button
                  type="button"
                  onClick={primary.action}
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-headline text-sm font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {loading ? 'Patientez…' : primary.label}
                  {!loading ? (
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      {primary.icon}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canCancel ? (
                <button type="button" onClick={handleCancel} disabled={loading} className="min-h-11 w-full rounded-full border border-outline-variant/40 py-3 font-headline text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-60">
                  Annuler l’échange
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="min-h-11 w-full rounded-full bg-surface-container-high py-3 font-headline text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest">
                Fermer
              </button>
            </div>
          </div>

          {canOpenDispute || exchange.dispute ? (
            <div className="mt-8 rounded-2xl border border-error-container/40 bg-error-container/15 p-6">
              {exchange.dispute && !canOpenDispute ? (
                <div className="flex gap-3 text-on-error-container">
                  <span className="material-symbols-outlined flex-shrink-0" aria-hidden>
                    gavel
                  </span>
                  <div>
                    <p className="font-headline font-bold">{DISPUTE_STATUS_LABEL[exchange.dispute.status]}</p>
                    <p className="mt-1 text-sm opacity-90">Ouvert le {formatDateFr(exchange.dispute.created_at)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">{exchange.dispute.reason}</p>
                    {exchange.dispute.resolution ? (
                      <p className="mt-3 rounded-xl bg-surface-container-lowest p-3 text-sm text-on-surface">
                        <span className="font-semibold">Décision : </span>
                        {exchange.dispute.resolution}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-on-surface-variant">Notre équipe examine la situation et vous tiendra informé par e-mail.</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {exchange.dispute ? (
                    <p className="mb-3 text-sm text-on-surface-variant">
                      Litige précédent : {DISPUTE_STATUS_LABEL[exchange.dispute.status].toLowerCase()}
                      {exchange.dispute.resolution ? ` — ${exchange.dispute.resolution}` : ''}
                    </p>
                  ) : null}
                  <button type="button" onClick={() => setShowDisputeForm((p) => !p)} className="min-h-10 text-sm font-bold text-error hover:underline">
                    {showDisputeForm ? 'Annuler' : 'Un problème ? Ouvrir un litige'}
                  </button>
                  {showDisputeForm ? (
                    <form onSubmit={handleOpenDispute} className="mt-4 space-y-3">
                      <label htmlFor="dispute-reason" className="sr-only">
                        Motif du litige
                      </label>
                      <textarea
                        id="dispute-reason"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={3}
                        minLength={5}
                        maxLength={3000}
                        placeholder="Expliquez le problème rencontré…"
                        required
                      />
                      {disputeError ? (
                        <p role="alert" className="text-sm text-error">
                          {disputeError}
                        </p>
                      ) : null}
                      <button type="submit" disabled={disputeLoading || disputeReason.trim().length < 5} className="min-h-11 w-full rounded-full bg-error px-4 py-3 font-headline text-sm font-bold text-on-error disabled:opacity-50">
                        {disputeLoading ? 'Envoi…' : 'Envoyer le litige'}
                      </button>
                    </form>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="flex gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high">
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-outline" aria-hidden>
                    handshake
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-bold text-on-surface">Annonce</h3>
                <p className="text-xs font-semibold text-on-surface">{listing?.title ?? '—'}</p>
                <p className="mt-1 line-clamp-4 text-xs text-on-surface-variant">{listing?.description_offer ?? 'Aucune description.'}</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high">
                <span className="material-symbols-outlined text-3xl text-primary" aria-hidden>
                  swap_horiz
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-bold text-on-surface">Avec {otherParty?.display_name ?? 'votre partenaire'}</h3>
                <p className="text-xs text-on-surface-variant">
                  {listing?.desired_exchange_desc?.trim() ? listing.desired_exchange_desc : 'Contrepartie décrite dans le contrat et la messagerie.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/20 bg-surface-container-low px-6 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Référence {transactionRef}</span>
          <a href={`mailto:contact@bontroc.fr?subject=Aide%20échange%20${encodeURIComponent(transactionRef)}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              help_outline
            </span>
            Aide
          </a>
        </div>
      </div>
    </div>
  );
}
