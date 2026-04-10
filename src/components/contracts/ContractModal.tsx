import { useEffect, useMemo, useState } from 'react';
import { supabase, Contract, type Listing, type Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type PartyUser = { id?: string; display_name?: string; avatar_url?: string };

type ProposalDetail = Proposal & {
  from_user?: PartyUser;
  to_user?: PartyUser;
  listing?: (Partial<Listing> & { media?: { url: string }[]; user_id?: string }) | null;
};

type ContractModalProps = {
  contract: Contract & { proposal?: Partial<ProposalDetail> };
  onClose: () => void;
  onAccepted: () => void;
};

function contractRef(id: string, createdAt: string) {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const short = id.replace(/-/g, '').slice(0, 3).toUpperCase();
  return `#BT-${y}-${m}-${day}-${short}`;
}

function initials(name?: string) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase();
}

const MODE_LABEL: Record<string, string> = {
  remote: 'À distance',
  on_site: 'Sur place',
  both: 'Mixte (à distance et sur place)',
};

export function ContractModal({ contract, onClose, onAccepted }: ContractModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSourceHtml, setShowSourceHtml] = useState(false);
  const [hasReadAndAccepted, setHasReadAndAccepted] = useState(false);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);

  useEffect(() => {
    if (!contract.proposal_id) return;
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('proposals')
        .select(
          `
          *,
          from_user:users!proposals_from_user_id_fkey(id, display_name, avatar_url),
          to_user:users!proposals_to_user_id_fkey(id, display_name, avatar_url),
          listing:listings(
            *,
            media:listing_media(*)
          )
        `,
        )
        .eq('id', contract.proposal_id)
        .maybeSingle();
      if (!cancelled && !qErr && data) setProposalDetail(data as ProposalDetail);
    })();
    return () => {
      cancelled = true;
    };
  }, [contract.proposal_id]);

  const proposal = useMemo(() => {
    const emb = contract.proposal as ProposalDetail | undefined;
    if (proposalDetail) return proposalDetail;
    return emb ?? null;
  }, [contract.proposal, proposalDetail]);

  const fromUser = proposal?.from_user;
  const toUser = proposal?.to_user;
  const listing = proposal?.listing as (Partial<Listing> & { media?: { url: string }[] }) | undefined;

  const isFromUser = proposal?.from_user_id === user?.id;
  const hasUserAccepted = isFromUser ? !!contract.accepted_by_from_at : !!contract.accepted_by_to_at;
  const hasOtherAccepted = isFromUser ? !!contract.accepted_by_to_at : !!contract.accepted_by_from_at;
  const bothSigned = hasUserAccepted && hasOtherAccepted;

  const listingImage = listing?.media?.[0]?.url;
  const modeKey = listing?.mode ?? 'both';
  const modeLabel = MODE_LABEL[modeKey] ?? MODE_LABEL.both;

  async function handleAccept() {
    if (hasUserAccepted) {
      setError('Vous avez déjà accepté ce contrat.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: currentContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();
      if (!currentContract) throw new Error('Contrat introuvable');
      const alreadyAccepted = isFromUser
        ? !!currentContract.accepted_by_from_at
        : !!currentContract.accepted_by_to_at;
      if (alreadyAccepted) {
        setError('Vous avez déjà accepté ce contrat.');
        setLoading(false);
        onAccepted();
        return;
      }
      const updateField = isFromUser ? 'accepted_by_from_at' : 'accepted_by_to_at';
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', contract.id);
      if (updateError) throw updateError;
      const { data: updatedContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();
      if (updatedContract?.accepted_by_from_at && updatedContract?.accepted_by_to_at) {
        await supabase.from('contracts').update({ status: 'active' }).eq('id', contract.id);
      }
      onAccepted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'acceptation");
    } finally {
      setLoading(false);
    }
  }

  function downloadContract() {
    const blob = new Blob([contract.html_content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrat-${contract.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const listingOwnerName = useMemo(() => {
    if (!listing?.user_id || !fromUser || !toUser) return fromUser?.display_name ?? '—';
    return listing.user_id === proposal?.from_user_id
      ? fromUser.display_name ?? '—'
      : toUser.display_name ?? '—';
  }, [listing?.user_id, proposal?.from_user_id, fromUser, toUser]);

  const youLabel = (partyUserId?: string) =>
    partyUserId && user?.id === partyUserId ? ' (Vous)' : '';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/50 backdrop-blur-[2px]">
      {/* Barre document (pas le header app) */}
      <header className="flex-shrink-0 border-b border-outline-variant/20 bg-slate-50/90 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="font-headline text-xl font-black tracking-tight text-slate-900 dark:text-white">
            BonTroc
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={downloadContract}
              className="flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-2 font-headline text-xs font-semibold text-on-surface-variant transition-all hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 sm:px-4 sm:text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              <span className="hidden sm:inline">Télécharger une copie</span>
              <span className="sm:hidden">PDF/HTML</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800"
              aria-label="Fermer"
            >
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">close</span>
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-40 pt-6 sm:px-6">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/40 bg-surface-container-lowest shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
          {/* En-tête document */}
          <div className="border-b border-outline-variant/10 bg-slate-50 p-8 dark:border-slate-700 dark:bg-slate-800/80 md:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
              <div>
                <div className="mb-4 inline-block rounded-full bg-primary-fixed px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-on-primary-fixed dark:bg-primary/30 dark:text-primary-fixed">
                  Document officiel
                </div>
                <h1 className="font-headline text-3xl font-extrabold leading-tight tracking-tight text-on-surface md:text-4xl">
                  {listing?.type === 'product'
                    ? "CONTRAT D'ÉCHANGE DE BIENS"
                    : "CONTRAT D'ÉCHANGE DE SERVICES"}
                </h1>
                <p className="mt-2 font-medium text-outline">
                  ID du contrat : {contractRef(contract.id, contract.created_at)}
                </p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-end">
                <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900">
                  <div className="flex -space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-on-primary dark:border-slate-900">
                      {initials(fromUser?.display_name)}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-container-highest text-xs font-bold text-on-surface-variant dark:border-slate-900 dark:bg-slate-700">
                      {initials(toUser?.display_name)}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-on-surface">
                    {bothSigned ? 'Signatures complètes' : 'Signatures en cours'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12 p-8 md:p-12">
            {error ? (
              <div className="rounded-xl border border-error-container bg-error-container/25 p-4 text-sm text-on-error-container">
                {error}
              </div>
            ) : null}

            {/* Statuts signatures */}
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="group flex items-center justify-between rounded-lg bg-surface-container-low p-6 transition-colors hover:bg-surface-container dark:bg-slate-800/60 dark:hover:bg-slate-800">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      hasUserAccepted ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[26px]"
                      style={hasUserAccepted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {hasUserAccepted ? 'check_circle' : 'pending'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Votre statut</p>
                    <p className="text-lg font-bold text-on-surface">
                      {hasUserAccepted ? 'Accepté' : 'En attente'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium italic text-outline">
                  {hasUserAccepted ? 'Signé numériquement' : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-secondary-container/30 bg-secondary-container/10 p-6 dark:border-yellow-700/40 dark:bg-yellow-900/10">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/30 text-secondary dark:bg-yellow-800/40 dark:text-secondary-fixed">
                    <span className="material-symbols-outlined">pending</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">
                      Statut {isFromUser ? toUser?.display_name ?? 'autre partie' : fromUser?.display_name ?? 'autre partie'}
                    </p>
                    <p className="text-lg font-bold text-on-surface">
                      {hasOtherAccepted ? 'Accepté' : 'En attente'}
                    </p>
                  </div>
                </div>
                {!hasOtherAccepted ? (
                  <div className="h-3 w-3 animate-pulse rounded-full bg-secondary dark:bg-yellow-500" />
                ) : (
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                )}
              </div>
            </section>

            {bothSigned ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
                <p className="flex items-center gap-2 font-headline font-semibold">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  Contrat entièrement signé sur BonTroc et actif.
                </p>
              </div>
            ) : null}

            {/* Parties */}
            <section>
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" />
                <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  Les parties
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-4 rounded-lg bg-surface-container-low p-6 dark:bg-slate-800/50">
                  <h3 className="flex items-center gap-2 font-bold text-primary">
                    <span className="material-symbols-outlined text-sm">corporate_fare</span>
                    Partie A (Initiateur)
                  </h3>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-on-surface">{fromUser?.display_name ?? '—'}</p>
                    <p className="text-sm text-outline">
                      {user?.id === proposal?.from_user_id ? 'Vous-même' : 'Représentant / membre BonTroc'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 rounded-lg bg-surface-container-low p-6 dark:bg-slate-800/50">
                  <h3 className="flex items-center gap-2 font-bold text-primary">
                    <span className="material-symbols-outlined text-sm">person</span>
                    Partie B (Destinataire)
                  </h3>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-on-surface">{toUser?.display_name ?? '—'}</p>
                    <p className="text-sm text-outline">
                      {user?.id === proposal?.to_user_id ? 'Vous-même' : 'Représentant / membre BonTroc'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Produits / services */}
            <section>
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" />
                <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  {listing?.type === 'product' ? 'Biens échangés' : 'Prestations échangées'}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="group">
                  <div className="relative mb-4 h-48 overflow-hidden rounded-xl bg-surface-container-high">
                    {listingImage ? (
                      <img
                        src={listingImage}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-outline">image</span>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-headline text-[10px] font-bold uppercase backdrop-blur dark:bg-slate-900/90">
                      De {listingOwnerName}
                      {listing?.user_id && user?.id === listing.user_id ? ' (Vous)' : ''}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-on-surface">{listing?.title ?? 'Annonce associée'}</h3>
                  <p className="text-sm leading-relaxed text-outline">
                    {listing?.description_offer?.trim()
                      ? listing.description_offer
                      : 'Description fournie dans le contrat HTML ci-dessous ou lors des échanges.'}
                  </p>
                </div>
                <div className="group">
                  <div className="relative mb-4 flex h-48 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high dark:bg-slate-800">
                    <span className="material-symbols-outlined text-6xl text-primary/40">swap_horiz</span>
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-headline text-[10px] font-bold uppercase backdrop-blur dark:bg-slate-900/90">
                      Contrepartie
                      {listing?.user_id === proposal?.from_user_id
                        ? ` · ${toUser?.display_name ?? ''}${youLabel(proposal?.to_user_id)}`
                        : ` · ${fromUser?.display_name ?? ''}${youLabel(proposal?.from_user_id)}`}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-on-surface">Échange attendu</h3>
                  <p className="text-sm leading-relaxed text-outline">
                    {listing?.desired_exchange_desc?.trim()
                      ? listing.desired_exchange_desc
                      : "Modalités de l'échange décrites dans le corps du contrat et les messages associés."}
                  </p>
                </div>
              </div>
            </section>

            {/* Logistique */}
            <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="flex flex-col justify-between rounded-xl bg-primary p-8 text-on-primary lg:col-span-4">
                <div>
                  <span className="material-symbols-outlined mb-6 text-4xl opacity-95">local_shipping</span>
                  <h2 className="mb-4 font-headline text-2xl font-bold leading-tight">Logistique & livraison</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined opacity-80">event</span>
                    <span className="font-medium">
                      {new Date(contract.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined opacity-80">location_on</span>
                    <span className="font-medium">Selon accord entre les parties (BonTroc)</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-surface-container-low p-8 dark:bg-slate-800/60 lg:col-span-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-outline">Mode</p>
                    <p className="text-lg font-bold text-on-surface">{modeLabel}</p>
                    <p className="mt-2 text-sm italic text-outline">
                      Les modalités concrètes (remise en main propre, envoi, visio) sont à préciser entre vous.
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-outline">Point de rencontre</p>
                    <div className="h-32 overflow-hidden rounded-lg bg-white shadow-inner dark:bg-slate-900">
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-outline">
                        Carte / lieu à convenir dans la messagerie BonTroc
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Clauses */}
            <section className="border-t border-outline-variant/30 pt-12">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-primary" />
                <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-on-surface">
                  Clauses contractuelles
                </h2>
              </div>
              <div className="space-y-6 text-sm leading-relaxed text-on-surface-variant">
                <div className="flex gap-4">
                  <span className="shrink-0 font-bold text-primary">01.</span>
                  <p>
                    <span className="font-bold text-on-surface">Conformité :</span> les parties s’engagent à décrire
                    fidèlement les biens ou services échangés. Un délai raisonnable après réception est recommandé pour
                    signaler une non-conformité majeure via la plateforme.
                  </p>
                </div>
                <div className="flex gap-4">
                  <span className="shrink-0 font-bold text-primary">02.</span>
                  <p>
                    <span className="font-bold text-on-surface">Engagement :</span> la signature électronique sur BonTroc
                    vaut acceptation des termes du présent contrat. Le contrat devient actif lorsque les deux parties ont
                    signé.
                  </p>
                </div>
                <div className="flex gap-4">
                  <span className="shrink-0 font-bold text-primary">03.</span>
                  <p>
                    <span className="font-bold text-on-surface">Litiges :</span> en cas de désaccord, les parties sont
                    invitées à utiliser les outils de médiation et le support BonTroc avant toute démarche extérieure.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSourceHtml((v) => !v)}
                className="mt-8 text-sm font-bold text-primary hover:underline"
              >
                {showSourceHtml ? 'Masquer' : 'Voir'} le document HTML généré
              </button>
              {showSourceHtml ? (
                <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-xs dark:bg-slate-900">
                  <div className="max-w-none text-on-surface" dangerouslySetInnerHTML={{ __html: contract.html_content }} />
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {/* Pied fixe */}
      <footer className="fixed bottom-0 left-0 z-[61] w-full border-t border-outline-variant/20 bg-white/90 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary dark:bg-primary/30 dark:text-primary-fixed">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                info
              </span>
            </div>
            <p className="font-headline text-sm font-semibold text-on-surface sm:text-base">
              {hasUserAccepted ? (
                <>
                  Vous avez accepté ce contrat.{' '}
                  <span className="text-outline">
                    {hasOtherAccepted
                      ? "L'autre partie a également signé."
                      : "En attente de l'acceptation de l'autre partie."}
                  </span>
                </>
              ) : (
                <>
                  Action requise :{' '}
                  <span className="text-outline">lisez le contrat puis signez électroniquement.</span>
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {!hasUserAccepted ? (
              <>
                <label className="flex max-w-md cursor-pointer items-start gap-2 text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30"
                    checked={hasReadAndAccepted}
                    onChange={(e) => setHasReadAndAccepted(e.target.checked)}
                  />
                  <span>
                    J’ai lu ce contrat et j’accepte qu’un clic sur « Signer » vaille signature électronique simple.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={loading || !hasReadAndAccepted}
                  className="rounded-full bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Signature…' : 'Signer le contrat'}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-on-surface px-8 py-3 font-headline text-sm font-bold text-surface transition-all hover:opacity-90 active:scale-95 dark:bg-slate-100 dark:text-slate-900"
            >
              Fermer
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
