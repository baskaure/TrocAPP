import { useState, useEffect, useRef, type FormEvent } from 'react';
import { CheckCircle, XCircle, Send } from 'lucide-react';
import { supabase, errorMessage, type Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { ChatWindow } from '../chat/ChatWindow';
import { sendTransactionalEmail } from '../../lib/notifications';
import { PageBackLink } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { checkContent } from '../../lib/moderation';
import { PROPOSAL_STATUS_CLASS, PROPOSAL_STATUS_LABEL } from '../../lib/labels';

type ProposalDetailModalProps = {
  proposal: Proposal | null;
  onClose: () => void;
  onUpdate: () => void;
  onUserClick?: (userId: string) => void;
  /** Ouvre en faisant défiler vers le chat (mobile) */
  initialFocusChat?: boolean;
  onOpenExchanges?: () => void;
  onOpenProfile?: () => void;
};

export function ProposalDetailModal({
  proposal,
  onClose,
  onUpdate,
  onUserClick,
  initialFocusChat = false,
  onOpenExchanges,
  onOpenProfile,
}: ProposalDetailModalProps) {
  const { user } = useAuth();
  const { toast, confirm } = useNotice();
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localStatus, setLocalStatus] = useState<Proposal['status'] | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const proposalId = proposal?.id;
  useEffect(() => {
    setLocalStatus(null);
    setError('');
    setShowCounterForm(false);
  }, [proposalId]);

  useEffect(() => {
    if (proposalId && initialFocusChat && chatRef.current) {
      window.setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [proposalId, initialFocusChat]);

  if (!proposal || !user) return null;

  const status = localStatus ?? proposal.status;
  const isReceiver = proposal.to_user_id === user.id;
  const isSender = proposal.from_user_id === user.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;
  const shortRef = proposal.id.replace(/-/g, '').slice(0, 10).toUpperCase();
  const otherDeleted = otherUser?.status === 'deleted';

  const nextStepCopy =
    status === 'accepted'
      ? 'Proposition acceptée : le contrat d’échange est prêt à être signé dans « Mes échanges ».'
      : status === 'pending' && isReceiver
        ? 'Vous pouvez accepter, refuser ou envoyer une contre-proposition ci-dessous.'
        : status === 'pending' && !isReceiver
          ? 'En attente de la réponse de votre interlocuteur. Vous pouvez encore annuler.'
          : status === 'countered'
            ? 'Une contre-proposition a été envoyée : retrouvez-la dans vos propositions reçues.'
            : status === 'refused'
              ? 'Cette proposition a été refusée.'
              : 'Cette proposition a été annulée.';

  const handleAccept = async () => {
    const ok = await confirm({
      title: 'Accepter cette proposition ?',
      description: 'Un contrat d’échange sera généré et proposé à la signature des deux parties.',
      confirmLabel: 'Accepter',
    });
    if (!ok) return;
    setError('');
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('accept-proposal', { body: { proposal_id: proposal.id } });
      if (fnError) {
        let detail = '';
        try {
          const ctx = (fnError as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') detail = String((await ctx.json())?.error ?? '');
        } catch {
          /* pas de détail exploitable */
        }
        throw new Error(detail || 'Acceptation impossible pour le moment.');
      }
      if (data?.error) throw new Error(String(data.error));
      setLocalStatus('accepted');
      toast.success('Proposition acceptée. Le contrat vous attend dans « Mes échanges ».');
      onUpdate();
    } catch (err: unknown) {
      setError(errorMessage(err, "Une erreur est survenue lors de l'acceptation"));
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = async () => {
    const ok = await confirm({ title: 'Refuser cette proposition ?', confirmLabel: 'Refuser', danger: true });
    if (!ok) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposal.id)
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .select('id');
      if (err) throw err;
      if (!data || data.length === 0) throw new Error('Cette proposition a déjà changé de statut.');
      setLocalStatus('refused');
      toast.info('Proposition refusée.');
      onUpdate();
    } catch (e) {
      setError(errorMessage(e, 'Impossible de refuser la proposition.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({ title: 'Annuler votre proposition ?', confirmLabel: 'Annuler la proposition', danger: true });
    if (!ok) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('proposals')
        .update({ status: 'cancelled' })
        .eq('id', proposal.id)
        .eq('from_user_id', user.id)
        .in('status', ['pending', 'countered'])
        .select('id');
      if (err) throw err;
      if (!data || data.length === 0) throw new Error('Cette proposition ne peut plus être annulée.');
      setLocalStatus('cancelled');
      toast.info('Proposition annulée.');
      onUpdate();
    } catch (e) {
      setError(errorMessage(e, "Impossible d'annuler la proposition."));
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async (e: FormEvent) => {
    e.preventDefault();
    if (!otherUser?.id) return setError('Contrepartie introuvable');
    const offer = counterOffer.trim();
    const message = counterMessage.trim();
    if (offer.length < 5) return setError('Décrivez votre contre-proposition (5 caractères minimum).');
    setLoading(true);
    setError('');
    try {
      const moderation = await checkContent(`${offer}\n${message}`, user.id);
      if (moderation.hasBlock) {
        setError(`Le texte contient un terme interdit (${moderation.blockWords.join(', ')}).`);
        return;
      }
      const { data: created, error: insErr } = await supabase
        .from('proposals')
        .insert({
          listing_id: proposal.listing_id,
          from_user_id: user.id,
          to_user_id: otherUser.id,
          message,
          offer_payload: { description: offer },
          status: 'pending',
          parent_proposal_id: proposal.id,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const { error: updErr } = await supabase.from('proposals').update({ status: 'countered' }).eq('id', proposal.id).eq('status', 'pending');
      if (updErr) console.warn('Statut de la proposition parente non mis à jour :', updErr.message);

      void sendTransactionalEmail('counter_proposal', otherUser.id, {
        listing_title: proposal.listing?.title ?? 'votre annonce',
        counter_proposer_name: user.display_name,
        proposal_id: created.id,
      });

      setShowCounterForm(false);
      setLocalStatus('countered');
      toast.success('Contre-proposition envoyée.');
      onUpdate();
    } catch (err) {
      setError(errorMessage(err, "Impossible d'envoyer la contre-proposition."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full overflow-x-hidden bg-background pb-20 text-on-surface">
      <div className="w-full max-w-6xl space-y-8">
        <PageBackLink onClick={onClose} label="Retour aux propositions" />
        <header ref={detailsRef} id="proposal-detail-top" className="space-y-2 scroll-mt-24">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 font-headline text-xs font-bold uppercase ${PROPOSAL_STATUS_CLASS[status]}`}>{PROPOSAL_STATUS_LABEL[status]}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-outline">Réf. {shortRef}</span>
          </div>
          <h1 className="font-headline text-2xl font-extrabold leading-tight tracking-tight text-on-surface sm:text-3xl md:text-4xl">
            {proposal.listing?.title ?? 'Proposition'}
          </h1>
          <p className="text-base font-medium text-on-surface-variant md:text-lg">
            Proposition {isReceiver ? 'de' : 'pour'}{' '}
            <button
              type="button"
              onClick={() => otherUser?.id && !otherDeleted && onUserClick?.(otherUser.id)}
              disabled={!otherUser?.id || otherDeleted || !onUserClick}
              className={`text-primary ${otherUser?.id && onUserClick && !otherDeleted ? 'font-bold hover:underline' : ''}`}
            >
              {otherUser?.display_name ?? '—'}
            </button>
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg md:p-8">
              <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-outline">Détails de la proposition</h2>
              <div className="space-y-6">
                {proposal.offer_payload?.description ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-secondary">{isSender ? 'Ce que vous proposez' : 'Ce qui vous est proposé'}</p>
                    <div className="rounded-lg border-l-4 border-secondary bg-surface-container-low p-4">
                      <p className="whitespace-pre-wrap font-semibold text-on-surface">{String(proposal.offer_payload.description)}</p>
                    </div>
                  </div>
                ) : null}
                {proposal.message ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-primary">Message</p>
                    <div className="rounded-lg bg-surface-container-low p-4">
                      <p className="whitespace-pre-wrap text-on-surface">{proposal.message}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-outline-variant/20 pt-6">
                <button
                  type="button"
                  onClick={() => otherUser?.id && !otherDeleted && onUserClick?.(otherUser.id)}
                  disabled={!otherUser?.id || otherDeleted || !onUserClick}
                  className={`flex min-w-0 items-center gap-3 text-left ${otherUser?.id && onUserClick && !otherDeleted ? 'cursor-pointer hover:opacity-90' : ''}`}
                >
                  {otherUser?.avatar_url ? (
                    <img src={otherUser.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container" aria-hidden>
                      {(otherUser?.display_name?.[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-on-surface">{otherUser?.display_name}</p>
                    <p className="text-[10px] text-outline">
                      {otherUser && otherUser.rating_count > 0 ? `${Number(otherUser.rating_avg).toFixed(1)} · ${otherUser.rating_count} avis` : 'Membre BonTroc'}
                    </p>
                  </div>
                </button>
                {otherUser?.is_verified ? (
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }} aria-label="Membre vérifié">
                    verified
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-primary/10 bg-primary/5 p-6">
              <div className="mb-3 flex items-center gap-4">
                <span className="material-symbols-outlined text-primary" aria-hidden>
                  info
                </span>
                <p className="text-sm font-bold text-primary">Prochaine étape</p>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant">{nextStepCopy}</p>
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-error/30 bg-error-container/30 p-4 text-sm text-error">
                {error}
              </div>
            ) : null}

            {!showCounterForm && status === 'pending' && isReceiver && !otherDeleted ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-opacity disabled:opacity-50"
                >
                  <CheckCircle className="h-5 w-5" aria-hidden />
                  {loading ? 'Patientez…' : 'Accepter'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCounterForm(true)}
                  disabled={loading}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-secondary-container py-3 font-bold text-on-secondary-container transition-opacity disabled:opacity-50"
                >
                  <Send className="h-5 w-5" aria-hidden />
                  Contre-proposer
                </button>
                <button
                  type="button"
                  onClick={handleRefuse}
                  disabled={loading}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-error/40 py-3 font-bold text-error transition-opacity hover:bg-error-container/30 disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5" aria-hidden />
                  Refuser
                </button>
              </div>
            ) : null}

            {isSender && (status === 'pending' || status === 'countered') ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-outline-variant/40 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-50"
              >
                Annuler ma proposition
              </button>
            ) : null}

            {showCounterForm ? (
              <form onSubmit={handleCounter} className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                <div>
                  <label htmlFor="counter-offer" className="mb-1 block text-sm font-medium text-on-surface">
                    Votre contre-proposition
                  </label>
                  <textarea
                    id="counter-offer"
                    value={counterOffer}
                    onChange={(e) => setCounterOffer(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/20"
                    required
                    minLength={5}
                  />
                </div>
                <div>
                  <label htmlFor="counter-message" className="mb-1 block text-sm font-medium text-on-surface">
                    Message
                  </label>
                  <textarea
                    id="counter-message"
                    value={counterMessage}
                    onChange={(e) => setCounterMessage(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCounterForm(false)} className="min-h-11 flex-1 rounded-full border border-outline-variant/40 py-2 text-sm font-semibold hover:bg-surface-container-low">
                    Annuler
                  </button>
                  <button type="submit" disabled={loading} className="min-h-11 flex-1 rounded-full bg-primary py-2 text-sm font-bold text-on-primary disabled:opacity-50">
                    {loading ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            ) : null}

            {status === 'accepted' ? (
              <div className="flex items-start gap-4 rounded-xl border border-secondary/20 bg-secondary-container/20 p-4">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }} aria-hidden>
                  handshake
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-on-secondary-container">Échange validé</p>
                  <p className="text-[11px] text-on-secondary-container/80">Signez le contrat puis coordonnez la remise via la messagerie.</p>
                  {onOpenExchanges ? (
                    <button type="button" onClick={onOpenExchanges} className="mt-2 text-xs font-bold text-primary hover:underline">
                      Ouvrir mes échanges
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div ref={chatRef} id="proposal-chat-panel" className="min-h-0 lg:col-span-8">
            <ChatWindow proposalId={proposal.id} onUserClick={onUserClick} variant="immersive" />
          </div>
        </div>
      </div>

      <div className="pb-24 md:hidden" aria-hidden />

      <nav aria-label="Actions rapides" className="fixed bottom-6 left-4 right-4 z-[110] md:hidden">
        <div className="glass-panel flex items-center justify-between rounded-full border border-outline-variant/20 px-4 py-3 shadow-2xl">
          <button type="button" onClick={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth' })} className="flex min-h-11 min-w-11 flex-col items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
              description
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase">Détails</span>
          </button>
          <button type="button" onClick={() => chatRef.current?.scrollIntoView({ behavior: 'smooth' })} className="flex min-h-11 min-w-11 flex-col items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              forum
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase">Chat</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="-mt-8 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-primary text-on-primary shadow-xl"
            aria-label="Retour aux propositions"
          >
            <span className="material-symbols-outlined" aria-hidden>
              check
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExchanges?.();
            }}
            className="flex min-h-11 min-w-11 flex-col items-center justify-center text-outline"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              history_edu
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase">Échanges</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenProfile?.();
            }}
            className="flex min-h-11 min-w-11 flex-col items-center justify-center text-outline"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              person
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
