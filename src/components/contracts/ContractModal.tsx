import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { supabase, errorMessage, type Contract, type Listing, type Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { MODE_LABEL, formatDateFr } from '../../lib/labels';

type PartyUser = { id?: string; display_name?: string; avatar_url?: string | null };

type ProposalDetail = Omit<Proposal, 'from_user' | 'to_user' | 'listing'> & {
  from_user?: PartyUser | null;
  to_user?: PartyUser | null;
  listing?: (Partial<Omit<Listing, 'media'>> & { media?: { url: string }[]; user_id?: string }) | null;
};

type ContractModalProps = {
  contract: Contract & { proposal?: Partial<ProposalDetail> | null };
  onClose: () => void;
  onAccepted: () => void | Promise<void>;
};

function contractRef(id: string, createdAt: string) {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const short = id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `#BT-${y}-${m}-${day}-${short}`;
}

function initials(name?: string) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase();
}

export function ContractModal({ contract, onClose, onAccepted }: ContractModalProps) {
  const { user } = useAuth();
  const { toast } = useNotice();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasReadAndAccepted, setHasReadAndAccepted] = useState(false);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [localSignature, setLocalSignature] = useState<{ status: Contract['status']; from: string | null; to: string | null } | null>(null);

  useEffect(() => {
    if (!contract.proposal_id) return;
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('proposals')
        .select(
          `*,
          from_user:public_profiles!proposals_from_user_id_fkey(id, display_name, avatar_url),
          to_user:public_profiles!proposals_to_user_id_fkey(id, display_name, avatar_url),
          listing:listings(id, user_id, type, title, description_offer, desired_exchange_desc, mode, media:listing_media(url))`,
        )
        .eq('id', contract.proposal_id)
        .maybeSingle();
      if (!cancelled && !qErr && data) setProposalDetail(data as unknown as ProposalDetail);
    })();
    return () => {
      cancelled = true;
    };
  }, [contract.proposal_id]);

  useEffect(() => {
    setLocalSignature(null);
    setHasReadAndAccepted(false);
    setError('');
  }, [contract.id]);

  const proposal = useMemo(() => proposalDetail ?? ((contract.proposal as ProposalDetail | undefined) ?? null), [contract.proposal, proposalDetail]);
  const fromUser = proposal?.from_user;
  const toUser = proposal?.to_user;
  const listing = proposal?.listing ?? undefined;

  const acceptedFrom = localSignature ? localSignature.from : contract.accepted_by_from_at ?? null;
  const acceptedTo = localSignature ? localSignature.to : contract.accepted_by_to_at ?? null;
  const contractStatus = localSignature ? localSignature.status : contract.status;

  const isFromUser = proposal?.from_user_id === user?.id;
  const hasUserAccepted = isFromUser ? Boolean(acceptedFrom) : Boolean(acceptedTo);
  const hasOtherAccepted = isFromUser ? Boolean(acceptedTo) : Boolean(acceptedFrom);
  const bothSigned = Boolean(acceptedFrom && acceptedTo);
  const canSign = contractStatus === 'awaiting_signatures' && !hasUserAccepted;

  const listingImage = listing?.media?.[0]?.url;
  const modeLabel = MODE_LABEL[(listing?.mode ?? 'both') as keyof typeof MODE_LABEL] ?? MODE_LABEL.both;

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(contract.html_content ?? '', {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'link', 'meta', 'title', 'head'],
        FORBID_ATTR: ['style', 'onerror', 'onload'],
      }),
    [contract.html_content],
  );

  async function handleSign() {
    if (!canSign) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('sign_contract', { p_contract_id: contract.id });
      if (rpcError) throw rpcError;
      const result = data as { status: Contract['status']; accepted_by_from_at: string | null; accepted_by_to_at: string | null; already?: boolean };
      setLocalSignature({ status: result.status, from: result.accepted_by_from_at, to: result.accepted_by_to_at });
      toast.success(result.status === 'active' ? 'Contrat signé par les deux parties : l’échange peut démarrer.' : 'Votre signature est enregistrée.');
      await onAccepted();
    } catch (err) {
      setError(errorMessage(err, 'Signature impossible'));
    } finally {
      setLoading(false);
    }
  }

  function downloadContract() {
    const blob = new Blob([contract.html_content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrat-bontroc-${contractRef(contract.id, contract.created_at).replace('#', '')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const listingOwnerName = useMemo(() => {
    if (!listing?.user_id || !fromUser || !toUser) return fromUser?.display_name ?? '—';
    return listing.user_id === proposal?.from_user_id ? fromUser.display_name ?? '—' : toUser.display_name ?? '—';
  }, [listing?.user_id, proposal?.from_user_id, fromUser, toUser]);

  const youLabel = (partyUserId?: string) => (partyUserId && user?.id === partyUserId ? ' (vous)' : '');

  const statusBanner =
    contractStatus === 'completed'
      ? { text: 'Échange terminé : ce contrat est archivé.', cls: 'border-primary/20 bg-primary-fixed/40 text-on-primary-fixed' }
      : contractStatus === 'cancelled'
        ? { text: 'Cet échange a été annulé : le contrat est sans effet.', cls: 'border-error-container bg-error-container/30 text-on-error-container' }
        : bothSigned
          ? { text: 'Contrat signé par les deux parties. L’échange peut démarrer.', cls: 'border-primary/20 bg-primary-fixed/40 text-on-primary-fixed' }
          : null;

  return (
    <div className="flex w-full flex-col pb-20">
      <PageBackLink onClick={onClose} label="Retour aux échanges" />

      <div className="mb-6 flex flex-shrink-0 justify-end">
        <button
          type="button"
          onClick={downloadContract}
          className="flex min-h-10 items-center gap-2 rounded-full bg-surface-container-high px-3 py-2 font-headline text-xs font-semibold text-on-surface-variant transition-all hover:bg-surface-container-highest sm:px-4 sm:text-sm"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            download
          </span>
          Télécharger (HTML)
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-40 pt-2">
        <article className="w-full max-w-5xl overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
          <div className="border-b border-outline-variant/10 bg-surface-container-low p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
              <div>
                <div className="mb-4 inline-block rounded-full bg-primary-fixed px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-on-primary-fixed">Contrat d’échange</div>
                <h1 className="font-headline text-2xl font-black leading-tight tracking-tight text-on-surface sm:text-3xl md:text-4xl">
                  {listing?.type === 'product' ? 'Contrat d’échange de biens' : 'Contrat d’échange de services'}
                </h1>
                <p className="mt-2 font-medium text-outline">
                  Référence {contractRef(contract.id, contract.created_at)} · généré le {formatDateFr(contract.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-surface-container-lowest p-3 shadow-sm">
                <div className="flex -space-x-2" aria-hidden>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-on-primary">{initials(fromUser?.display_name)}</div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-container-highest text-xs font-bold text-on-surface-variant">{initials(toUser?.display_name)}</div>
                </div>
                <div className="text-xs font-semibold text-on-surface">{bothSigned ? 'Signatures complètes' : 'Signatures en cours'}</div>
              </div>
            </div>
          </div>

          <div className="space-y-12 p-8 md:p-12">
            {error ? (
              <div role="alert" className="rounded-xl border border-error-container bg-error-container/25 p-4 text-sm text-on-error-container">
                {error}
              </div>
            ) : null}
            {statusBanner ? (
              <div role="status" className={`rounded-xl border p-4 font-headline text-sm font-semibold ${statusBanner.cls}`}>
                {statusBanner.text}
              </div>
            ) : null}

            <section aria-label="État des signatures" className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${hasUserAccepted ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[26px]" style={hasUserAccepted ? { fontVariationSettings: "'FILL' 1" } : undefined} aria-hidden>
                      {hasUserAccepted ? 'check_circle' : 'pending'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Votre signature</p>
                    <p className="text-lg font-bold text-on-surface">{hasUserAccepted ? 'Signé' : 'En attente'}</p>
                  </div>
                </div>
                <span className="text-xs font-medium italic text-outline">{hasUserAccepted ? formatDateFr(isFromUser ? acceptedFrom : acceptedTo) : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-secondary-container/30 bg-secondary-container/10 p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${hasOtherAccepted ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container/30 text-secondary'}`}>
                    <span className="material-symbols-outlined" style={hasOtherAccepted ? { fontVariationSettings: "'FILL' 1" } : undefined} aria-hidden>
                      {hasOtherAccepted ? 'check_circle' : 'pending'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Signature de {isFromUser ? toUser?.display_name ?? 'l’autre partie' : fromUser?.display_name ?? 'l’autre partie'}</p>
                    <p className="text-lg font-bold text-on-surface">{hasOtherAccepted ? 'Signé' : 'En attente'}</p>
                  </div>
                </div>
                <span className="text-xs font-medium italic text-outline">{hasOtherAccepted ? formatDateFr(isFromUser ? acceptedTo : acceptedFrom) : '—'}</span>
              </div>
            </section>

            <section aria-labelledby="parties-title">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" aria-hidden />
                <h2 id="parties-title" className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  Les parties
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2 rounded-lg bg-surface-container-low p-6">
                  <h3 className="flex items-center gap-2 font-bold text-primary">
                    <span className="material-symbols-outlined text-sm" aria-hidden>
                      person
                    </span>
                    Partie A (a fait la proposition)
                  </h3>
                  <p className="text-xl font-bold text-on-surface">
                    {fromUser?.display_name ?? '—'}
                    {youLabel(proposal?.from_user_id)}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg bg-surface-container-low p-6">
                  <h3 className="flex items-center gap-2 font-bold text-primary">
                    <span className="material-symbols-outlined text-sm" aria-hidden>
                      person
                    </span>
                    Partie B (a publié l’annonce)
                  </h3>
                  <p className="text-xl font-bold text-on-surface">
                    {toUser?.display_name ?? '—'}
                    {youLabel(proposal?.to_user_id)}
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="objects-title">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" aria-hidden />
                <h2 id="objects-title" className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  {listing?.type === 'product' ? 'Biens échangés' : 'Prestations échangées'}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <div className="relative mb-4 h-48 overflow-hidden rounded-xl bg-surface-container-high">
                    {listingImage ? (
                      <img src={listingImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-outline" aria-hidden>
                          image
                        </span>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-headline text-[10px] font-bold uppercase backdrop-blur">
                      De {listingOwnerName}
                      {listing?.user_id && user?.id === listing.user_id ? ' (vous)' : ''}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-on-surface">{listing?.title ?? 'Annonce'}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-outline">{listing?.description_offer?.trim() || 'Voir le corps du contrat.'}</p>
                </div>
                <div>
                  <div className="relative mb-4 flex h-48 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high">
                    <span className="material-symbols-outlined text-6xl text-primary/40" aria-hidden>
                      swap_horiz
                    </span>
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-headline text-[10px] font-bold uppercase backdrop-blur">
                      Contrepartie de {fromUser?.display_name ?? ''}
                      {youLabel(proposal?.from_user_id)}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-on-surface">Ce qui est proposé en échange</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-outline">
                    {proposal?.offer_payload?.description?.trim() || proposal?.message?.trim() || 'Voir le corps du contrat et la messagerie.'}
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="logistics-title" className="rounded-xl bg-surface-container-low p-8">
              <h2 id="logistics-title" className="mb-4 font-headline text-xl font-bold leading-tight text-on-surface">
                Modalités
              </h2>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-outline">Mode d’échange</p>
                  <p className="text-lg font-bold text-on-surface">{modeLabel}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-outline">Lieu, date, état, quantité</p>
                  <p className="text-sm text-on-surface-variant">À convenir entre vous dans la messagerie BonTroc. Ces échanges font partie de votre accord.</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="contract-body-title" className="border-t border-outline-variant/30 pt-12">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" aria-hidden />
                <h2 id="contract-body-title" className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  Texte du contrat
                </h2>
              </div>
              <div className="contract-body rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </section>
          </div>
        </article>
      </div>

      <footer className="fixed bottom-0 left-0 z-[61] w-full border-t border-outline-variant/20 bg-surface-container-lowest/90 shadow-soft-lg backdrop-blur-lg">
        <div className="flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
                info
              </span>
            </div>
            <p className="font-headline text-sm font-semibold text-on-surface sm:text-base">
              {contractStatus !== 'awaiting_signatures' ? (
                <span className="text-outline">Ce contrat n’attend plus de signature.</span>
              ) : hasUserAccepted ? (
                <>
                  Vous avez signé. <span className="text-outline">{hasOtherAccepted ? "L'autre partie a également signé." : "En attente de la signature de l'autre partie."}</span>
                </>
              ) : (
                <>
                  Action requise : <span className="text-outline">lisez le contrat puis signez.</span>
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {canSign ? (
              <>
                <label className="flex max-w-md cursor-pointer items-start gap-2 text-xs text-on-surface-variant">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30" checked={hasReadAndAccepted} onChange={(e) => setHasReadAndAccepted(e.target.checked)} />
                  <span>J’ai lu ce contrat et j’accepte qu’un clic sur « Signer » vaille signature électronique simple.</span>
                </label>
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={loading || !hasReadAndAccepted}
                  className="min-h-11 rounded-full bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Signature…' : 'Signer le contrat'}
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-on-surface px-8 py-3 font-headline text-sm font-bold text-surface transition-all hover:opacity-90 active:scale-95">
              Fermer
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
