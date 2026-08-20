import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase, type Listing } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';

type TrackerExchange = {
  id: string;
  status: 'not_started' | 'in_progress' | 'delivered' | 'confirmed' | 'cancelled';
  due_date?: string;
  delivered_at?: string;
  delivered_by?: string;
  confirmed_at?: string;
  dispute?: {
    status: string;
    resolution?: string;
    resolution_notes?: string;
  } | null;
  contract?: {
    proposal?: {
      listing_id?: string;
      from_user_id?: string;
      to_user_id?: string;
      listing?: Partial<Listing> & { media?: { url: string }[] };
    };
  };
};

type ExchangeTrackerProps = {
  exchange: TrackerExchange;
  onClose: () => void;
  onUpdate: () => void;
};

const STEPS: { id: TrackerExchange['status']; label: string; icon: string }[] = [
  { id: 'not_started', label: 'Non démarré', icon: 'radio_button_checked' },
  { id: 'in_progress', label: 'En cours', icon: 'sync' },
  { id: 'delivered', label: 'Livré', icon: 'local_shipping' },
  { id: 'confirmed', label: 'Confirmé', icon: 'verified' },
];

function stepIndex(status: TrackerExchange['status']): number {
  if (status === 'cancelled') return -1;
  const i = STEPS.findIndex((s) => s.id === status);
  return i >= 0 ? i : 0;
}

export function ExchangeTracker({ exchange, onClose, onUpdate }: ExchangeTrackerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState('');
  const [listingDetail, setListingDetail] = useState<Listing | null>(null);

  const proposal = exchange.contract?.proposal;
  const listingId = proposal?.listing_id;

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('listings')
        .select('*, media:listing_media(*)')
        .eq('id', listingId)
        .maybeSingle();
      if (!cancelled && !qErr && data) setListingDetail(data as Listing);
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const listing = useMemo(() => {
    const embedded = proposal?.listing;
    if (listingDetail) return listingDetail;
    return embedded as Listing | undefined;
  }, [listingDetail, proposal?.listing]);

  const heroImageUrl = listing?.media?.[0]?.url;

  const currentIdx = stepIndex(exchange.status);

  const isFromUser = proposal?.from_user_id === user?.id;

  const canMarkAsInProgress = exchange.status === 'not_started';
  const canMarkAsDelivered = exchange.status === 'in_progress';
  const canConfirm = exchange.status === 'delivered' && exchange.delivered_by !== user?.id;
  const canOpenDispute = exchange.status === 'delivered' || exchange.status === 'in_progress';
  const shouldShowDisputeSection = canOpenDispute || Boolean(exchange.dispute);

  const statusBody = useMemo(() => {
    if (exchange.status === 'cancelled') {
      return {
        title: 'Échange annulé',
        text: 'Cet échange a été annulé. Aucune action n’est possible depuis cette fiche.',
      };
    }
    if (exchange.status === 'not_started') {
      return {
        title: 'Statut actuel',
        text: "L'échange n'a pas encore commencé. Cliquez sur « Démarrer l'échange » pour lancer la transaction.",
      };
    }
    if (exchange.status === 'in_progress') {
      return {
        title: 'Statut actuel',
        text: 'Échange en cours. Lorsque vous avez tenu votre engagement, marquez l’échange comme livré.',
      };
    }
    if (exchange.status === 'delivered') {
      return {
        title: 'Statut actuel',
        text:
          exchange.delivered_by === user?.id
            ? 'Vous avez indiqué que votre partie est livrée. L’autre partie doit confirmer la réception.'
            : "L'autre partie a marqué l'échange comme livré. Vérifiez et confirmez la réception si tout est conforme.",
      };
    }
    if (exchange.status === 'confirmed') {
      return {
        title: 'Statut actuel',
        text: 'Échange terminé et confirmé par les deux parties. Merci d’avoir utilisé BonTroc.',
      };
    }
    return { title: 'Statut actuel', text: '' };
  }, [exchange.delivered_by, exchange.status, user?.id]);

  async function handleStartExchange() {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({ status: 'in_progress' })
        .eq('id', exchange.id);
      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDispute(e: FormEvent) {
    e.preventDefault();
    if (!disputeReason.trim()) return;
    if (!user) {
      setDisputeError('Session expirée, veuillez vous reconnecter.');
      return;
    }
    setDisputeLoading(true);
    setDisputeError('');
    try {
      const { error: disputeErr } = await supabase.from('disputes').insert({
        exchange_id: exchange.id,
        opened_by: user.id,
        reason: disputeReason,
        status: 'open',
      });
      if (disputeErr) throw disputeErr;
      setShowDisputeForm(false);
      setDisputeReason('');
      onUpdate();
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : "Impossible d'ouvrir un litige");
    } finally {
      setDisputeLoading(false);
    }
  }

  async function handleMarkAsDelivered() {
    setLoading(true);
    setError('');
    try {
      if (!user?.id) {
        setError('Session expirée, veuillez vous reconnecter.');
        return;
      }
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_by: user.id,
        })
        .eq('id', exchange.id);
      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la livraison');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!user?.id) {
      setError('Session expirée, veuillez vous reconnecter.');
      return;
    }
    if (exchange.delivered_by === user.id) {
      setError("Vous ne pouvez pas confirmer la réception d'un échange que vous avez marqué comme livré.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: currentExchange } = await supabase
        .from('exchanges')
        .select('delivered_by, status')
        .eq('id', exchange.id)
        .single();
      if (!currentExchange) throw new Error('Échange introuvable');
      if (currentExchange.delivered_by === user.id) {
        setError("Vous ne pouvez pas confirmer la réception d'un échange que vous avez marqué comme livré.");
        return;
      }
      if (currentExchange.status !== 'delivered') {
        setError('Cet échange n’est pas en statut « livré ».');
        return;
      }
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', exchange.id);
      if (updateError) throw updateError;
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  }

  const transactionRef = useMemo(() => {
    const y = new Date().getFullYear();
    const short = exchange.id.replace(/-/g, '').slice(0, 4).toUpperCase();
    return `#BT-${y}-${short}`;
  }, [exchange.id]);

  const primaryLabel = canMarkAsInProgress
    ? "Démarrer l'échange"
    : canMarkAsDelivered
      ? 'Marquer comme livré'
      : canConfirm
        ? 'Confirmer la réception'
        : null;

  const primaryIcon = canMarkAsInProgress
    ? 'play_arrow'
    : canMarkAsDelivered
      ? 'local_shipping'
      : canConfirm
        ? 'verified'
        : null;

  const primaryAction = canMarkAsInProgress
    ? handleStartExchange
    : canMarkAsDelivered
      ? handleMarkAsDelivered
      : canConfirm
        ? handleConfirmDelivery
        : null;

  return (
    <div className="w-full pb-16">
      <PageBackLink onClick={onClose} label="Retour aux échanges" />
      <div
        className="relative w-full max-w-4xl overflow-x-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg dark:border-white/10 dark:bg-slate-900 dark:shadow-none"
        role="region"
        aria-labelledby="exchange-tracker-title"
      >
        {/* Hero */}
        <div className="relative h-44 w-full overflow-hidden sm:h-48">
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-primary to-primary-container opacity-20 mix-blend-multiply dark:opacity-30" />
          {heroImageUrl ? (
            <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary-container/20 to-surface-container-high dark:from-primary/40" />
          )}
          <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-12">
            <span className="mb-2 text-sm font-bold uppercase tracking-widest text-primary-fixed dark:text-primary-fixed">
              Suivi de transaction
            </span>
            <h1
              id="exchange-tracker-title"
              className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl"
            >
              Détails de l&apos;échange
            </h1>
          </div>
        </div>

        <div className="p-6 md:p-12">
          {error ? (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-error-container bg-error-container/30 p-4 text-sm text-on-error-container">
              <span className="material-symbols-outlined flex-shrink-0 text-[20px]">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {/* Timeline 4 colonnes */}
          <div className="relative mb-14 grid grid-cols-4 gap-2 sm:gap-4">
            <div className="absolute left-[12.5%] right-[12.5%] top-6 z-0 h-0.5 bg-surface-container-high dark:bg-slate-700" />
            {STEPS.map((step, index) => {
              const cancelled = exchange.status === 'cancelled';
              const reached = !cancelled && index <= currentIdx;
              const isFuture = cancelled || index > currentIdx;

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                      reached
                        ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 ring-4 ring-primary-fixed dark:ring-primary/40'
                        : 'bg-surface-container-high text-on-surface-variant dark:bg-slate-800'
                    } ${isFuture ? 'opacity-40' : ''}`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{step.icon}</span>
                  </div>
                  <p
                    className={`mt-3 text-xs sm:text-sm ${reached ? 'font-bold text-primary dark:text-primary' : 'font-medium text-on-surface-variant'} ${isFuture ? 'opacity-40' : ''}`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Statut + actions */}
          <div className="grid items-center gap-8 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-6 md:grid-cols-12 md:p-8 dark:border-white/10 dark:bg-slate-800/60">
            <div className="md:col-span-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-secondary-container p-2">
                  <span className="material-symbols-outlined text-on-secondary-container">info</span>
                </div>
                <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">{statusBody.title}</h2>
              </div>
              <p className="mb-6 text-lg leading-relaxed text-on-surface-variant">{statusBody.text}</p>
              {exchange.due_date ? (
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-900">
                    <span className="material-symbols-outlined text-base text-primary">calendar_today</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      Date limite :
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      {new Date(exchange.due_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ) : null}
              {exchange.delivered_at && exchange.status !== 'not_started' ? (
                <p className="mt-4 text-sm text-on-surface-variant">
                  Livré le {new Date(exchange.delivered_at).toLocaleDateString('fr-FR')}
                </p>
              ) : null}
              {exchange.confirmed_at && exchange.status === 'confirmed' ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  Confirmé le {new Date(exchange.confirmed_at).toLocaleDateString('fr-FR')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 md:col-span-4">
              {primaryAction && primaryLabel ? (
                <button
                  type="button"
                  onClick={primaryAction}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-headline text-sm font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {loading ? 'Patientez…' : primaryLabel}
                  {!loading && primaryIcon ? (
                    <span className="material-symbols-outlined text-[20px]">{primaryIcon}</span>
                  ) : null}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-surface-container-high py-4 font-headline text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Fermer
              </button>
            </div>
          </div>

          {shouldShowDisputeSection ? (
            <div className="mt-8 rounded-2xl border border-error-container/40 bg-error-container/15 p-6 dark:bg-red-950/20">
              {exchange.dispute ? (
                <div className="flex gap-3 text-on-error-container">
                  <span className="material-symbols-outlined flex-shrink-0">gavel</span>
                  <div>
                    <p className="font-headline font-bold">
                      {exchange.dispute.status === 'resolved' ? 'Litige résolu' : 'Litige en cours'}
                    </p>
                    <p className="mt-1 text-sm capitalize opacity-90">Statut : {exchange.dispute.status}</p>
                    {exchange.dispute.resolution ? (
                      <p className="mt-2 text-sm text-on-surface">{exchange.dispute.resolution}</p>
                    ) : null}
                    {exchange.dispute.resolution_notes ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{exchange.dispute.resolution_notes}</p>
                    ) : null}
                  </div>
                </div>
              ) : canOpenDispute ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm((p) => !p)}
                    className="text-sm font-bold text-error hover:underline"
                  >
                    {showDisputeForm ? 'Annuler' : 'Ouvrir un litige'}
                  </button>
                  {showDisputeForm ? (
                    <form onSubmit={handleOpenDispute} className="mt-4 space-y-3">
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-900"
                        rows={3}
                        placeholder="Expliquez le problème rencontré…"
                        required
                      />
                      {disputeError ? <p className="text-sm text-error">{disputeError}</p> : null}
                      <button
                        type="submit"
                        disabled={disputeLoading || !disputeReason.trim()}
                        className="w-full rounded-full bg-error px-4 py-3 font-headline text-sm font-bold text-on-error disabled:opacity-50"
                      >
                        {disputeLoading ? 'Envoi…' : 'Envoyer le litige'}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Litige clôturé. Contactez le support si besoin.</p>
              )}
            </div>
          ) : null}

          {/* Détails annonce */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="flex gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high dark:bg-slate-800">
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-outline">handshake</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-bold text-on-surface">Service / offre proposé</h3>
                <p className="text-xs font-semibold text-on-surface">{listing?.title ?? '—'}</p>
                <p className="mt-1 line-clamp-4 text-xs text-on-surface-variant">
                  {listing?.description_offer ?? 'Aucune description.'}
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high dark:bg-slate-800">
                <span className="material-symbols-outlined text-3xl text-primary">swap_horiz</span>
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-bold text-on-surface">Contrepartie souhaitée</h3>
                <p className="text-xs text-on-surface-variant">
                  {listing?.desired_exchange_desc?.trim()
                    ? listing.desired_exchange_desc
                    : isFromUser
                      ? 'Ce que vous attendez en retour de la contrepartie.'
                      : 'Ce que le proposeur attend en échange.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/20 bg-surface-container-low px-6 py-4 opacity-80 dark:border-slate-700 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            ID transaction {transactionRef}
          </span>
          <div className="flex gap-4 text-on-surface-variant">
            <a
              href="mailto:contact@bontroc.fr?subject=Aide%20suivi%20échange"
              className="transition-colors hover:text-primary"
              aria-label="Aide"
            >
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
            </a>
            <a
              href="mailto:contact@bontroc.fr?subject=Signalement%20échange"
              className="transition-colors hover:text-primary"
              aria-label="Signaler un problème"
            >
              <span className="material-symbols-outlined text-[18px]">report_problem</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
