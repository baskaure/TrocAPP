import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Send } from 'lucide-react';
import { supabase, Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { ChatWindow } from '../chat/ChatWindow';
import { sendTransactionalEmail } from '../../lib/notifications';
import { enqueueEsignRequest, isEsignEnabled } from '../../lib/esign';

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
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const detailsRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (proposal && initialFocusChat && chatRef.current) {
      window.setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [proposal?.id, initialFocusChat]);

  if (!proposal) return null;

  const isReceiver = proposal.to_user_id === user?.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;
  const shortRef = proposal.id.replace(/-/g, '').slice(0, 10).toUpperCase();

  const statusPillClass =
    proposal.status === 'accepted'
      ? 'bg-secondary-container text-on-secondary-container'
      : proposal.status === 'refused'
        ? 'bg-error-container text-on-error-container'
        : proposal.status === 'countered'
          ? 'bg-secondary-fixed text-on-secondary-fixed'
          : 'bg-primary-fixed text-primary';

  const statusText =
    proposal.status === 'accepted'
      ? 'Acceptée'
      : proposal.status === 'refused'
        ? 'Refusée'
        : proposal.status === 'countered'
          ? 'Contre-proposition'
          : 'En attente';

  const nextStepCopy =
    proposal.status === 'accepted'
      ? "L'échange a été accepté. Vous pouvez maintenant discuter des détails logistiques (date, lieu) via le chat."
      : proposal.status === 'pending' && isReceiver
        ? 'Vous pouvez accepter, refuser ou envoyer une contre-proposition ci-dessous.'
        : proposal.status === 'pending' && !isReceiver
          ? 'En attente de la réponse de votre interlocuteur.'
          : proposal.status === 'countered'
            ? 'Une contre-proposition est en cours de discussion.'
            : 'Cette proposition est close.';

  const handleAccept = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.from('proposals').update({ status: 'accepted' }).eq('id', proposal.id);

      if (updateError) {
        console.error('Error updating proposal:', updateError);
        throw updateError;
      }

      const { error: contractFnError } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (contractFnError) {
        console.error('Error generating contract via edge function:', contractFnError);
        throw contractFnError;
      }

      const listingTitle = proposal.listing?.title || 'Votre échange';
      sendTransactionalEmail('contract_ready', proposal.from_user?.email, {
        listing_title: listingTitle,
        proposal_id: proposal.id,
        counterpart_name: proposal.to_user?.display_name,
      });
      if (proposal.to_user?.email && proposal.to_user.email !== proposal.from_user?.email) {
        sendTransactionalEmail('contract_ready', proposal.to_user.email, {
          listing_title: listingTitle,
          proposal_id: proposal.id,
          counterpart_name: proposal.from_user?.display_name,
        });
      }

      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('proposal_id', proposal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contract?.id && isEsignEnabled()) {
        try {
          await enqueueEsignRequest({
            contractId: contract.id,
            listingTitle,
            participants: [
              {
                id: proposal.from_user_id,
                email: proposal.from_user?.email,
                name: proposal.from_user?.display_name,
              },
              {
                id: proposal.to_user_id,
                email: proposal.to_user?.email,
                name: proposal.to_user?.display_name,
              },
            ],
          });
        } catch (esignError) {
          console.warn('Impossible de préparer la signature électronique', esignError);
        }
      }

      onUpdate();
      onClose();
    } catch (err: unknown) {
      console.error('Error accepting proposal:', err);
      const errorMessage =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : "Une erreur est survenue lors de l'acceptation";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = async () => {
    setLoading(true);
    try {
      const { error: err } = await supabase.from('proposals').update({ status: 'refused' }).eq('id', proposal.id);

      if (err) throw err;
      onUpdate();
      onClose();
    } catch (e) {
      console.error('Error refusing proposal:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!otherUser?.id) throw new Error('Contrepartie introuvable');

      const { error: insErr } = await supabase.from('proposals').insert({
        listing_id: proposal.listing_id,
        from_user_id: user!.id,
        to_user_id: otherUser.id,
        message: counterMessage,
        offer_payload: { description: counterOffer },
        status: 'pending',
        parent_proposal_id: proposal.id,
      });

      if (insErr) throw insErr;

      await supabase.from('proposals').update({ status: 'countered' }).eq('id', proposal.id);

      setShowCounterForm(false);
      onUpdate();
      onClose();
    } catch (e) {
      console.error('Error countering proposal:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background text-on-surface">
      <nav className="sticky top-0 z-50 border-b border-outline-variant/10 bg-surface dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Retour"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="truncate font-headline text-lg font-semibold text-on-surface md:text-xl">
              {proposal.listing?.title ?? 'Proposition'}
            </span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-10">
        <header ref={detailsRef} id="proposal-detail-top" className="space-y-2 scroll-mt-24">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 font-headline text-xs font-bold ${statusPillClass}`}>
              {statusText.toUpperCase()}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-outline">ID : {shortRef}</span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold leading-tight tracking-tight text-on-surface md:text-5xl">
            {proposal.listing?.title ?? 'Proposition'}
          </h1>
          <p className="text-lg font-medium text-on-surface-variant">
            Proposition {isReceiver ? 'de' : 'pour'}{' '}
            <button
              type="button"
              onClick={() => otherUser?.id && onUserClick?.(otherUser.id)}
              className={`text-primary ${otherUser?.id && onUserClick ? 'font-bold hover:underline' : ''}`}
            >
              {otherUser?.display_name ?? '—'}
            </button>
            <span className="text-on-surface-variant"> · </span>
            <span className="font-bold text-primary">Statut : {statusText}</span>
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0px_20px_40px_rgba(25,28,29,0.04)] md:p-8">
              <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-outline">Détails de l&apos;échange</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-tighter text-primary">Votre message</label>
                  <div className="rounded-lg bg-surface-container-low p-4">
                    <p className="whitespace-pre-wrap font-semibold text-on-surface">{proposal.message}</p>
                  </div>
                </div>
                {proposal.offer_payload?.description ? (
                  <>
                    <div className="flex justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-sm">
                        <span className="material-symbols-outlined">swap_horiz</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-tighter text-secondary">En échange</label>
                      <div className="rounded-lg border-l-4 border-secondary bg-surface-container-low p-4">
                        <p className="whitespace-pre-wrap font-semibold text-on-surface">
                          {String(proposal.offer_payload.description)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-outline-variant/20 pt-6">
                <button
                  type="button"
                  onClick={() => otherUser?.id && onUserClick?.(otherUser.id)}
                  className={`flex min-w-0 items-center gap-3 text-left ${otherUser?.id && onUserClick ? 'cursor-pointer hover:opacity-90' : ''}`}
                >
                  {otherUser?.avatar_url ? (
                    <img src={otherUser.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container">
                      {(otherUser?.display_name?.[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-on-surface">{otherUser?.display_name}</p>
                    <p className="text-[10px] text-outline">
                      {otherUser && otherUser.rating_count > 0
                        ? `${otherUser.rating_avg.toFixed(1)} · ${otherUser.rating_count} avis`
                        : 'Membre BonTroc'}
                    </p>
                  </div>
                </button>
                {otherUser?.is_verified ? (
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    verified
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-primary/10 bg-primary/5 p-6">
              <div className="mb-3 flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">info</span>
                <p className="text-sm font-bold text-primary">Prochaine étape</p>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant">{nextStepCopy}</p>
            </div>

            {error ? (
              <div className="rounded-xl border border-error/30 bg-error-container/30 p-4 text-sm text-error">{error}</div>
            ) : null}

            {!showCounterForm && proposal.status === 'pending' && isReceiver ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-opacity disabled:opacity-50"
                >
                  <CheckCircle className="h-5 w-5" />
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => setShowCounterForm(true)}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-secondary-container py-3 font-bold text-on-secondary-container transition-opacity disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                  Contre-proposer
                </button>
                <button
                  type="button"
                  onClick={handleRefuse}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full border border-error/40 py-3 font-bold text-error transition-opacity hover:bg-error-container/30 disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5" />
                  Refuser
                </button>
              </div>
            ) : null}

            {showCounterForm ? (
              <form onSubmit={handleCounter} className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-on-surface">Votre contre-proposition</label>
                  <textarea
                    value={counterOffer}
                    onChange={(e) => setCounterOffer(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-on-surface">Message</label>
                  <textarea
                    value={counterMessage}
                    onChange={(e) => setCounterMessage(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCounterForm(false)}
                    className="flex-1 rounded-full border border-outline-variant/40 py-2 text-sm font-semibold hover:bg-surface-container-low"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            ) : null}

            {proposal.status === 'accepted' ? (
              <div className="flex items-start gap-4 rounded-xl border border-secondary/20 bg-secondary-container/20 p-4">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  handshake
                </span>
                <div>
                  <p className="text-xs font-bold text-on-secondary-container">Échange validé</p>
                  <p className="text-[11px] text-on-secondary-container/80">
                    Un contrat PDF peut être généré ; utilisez le chat pour coordonner la livraison.
                  </p>
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

      <div className="fixed bottom-6 left-4 right-4 z-[110] md:hidden">
        <nav className="glass-panel flex items-center justify-between rounded-full border border-outline-variant/20 px-4 py-3 shadow-2xl">
          <button
            type="button"
            onClick={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center text-primary"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              description
            </span>
            <span className="mt-0.5 text-[8px] font-bold uppercase">Détails</span>
          </button>
          <button
            type="button"
            onClick={() => chatRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center text-outline"
          >
            <span className="material-symbols-outlined text-[22px]">forum</span>
            <span className="mt-0.5 text-[8px] font-bold uppercase">Chat</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="-mt-8 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-primary text-on-primary shadow-xl"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined">check</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExchanges?.();
            }}
            className="flex flex-col items-center text-outline"
          >
            <span className="material-symbols-outlined text-[22px]">history_edu</span>
            <span className="mt-0.5 text-[8px] font-bold uppercase">Contrat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenProfile?.();
            }}
            className="flex flex-col items-center text-outline"
          >
            <span className="material-symbols-outlined text-[22px]">person</span>
            <span className="mt-0.5 text-[8px] font-bold uppercase">Profil</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
