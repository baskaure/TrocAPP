import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, errorMessage, type Exchange, type Contract, type Dispute, type ExchangeStatus } from '../../lib/supabase';
import { ExchangeTracker } from './ExchangeTracker';
import { ReviewModal } from './ReviewModal';
import { ContractModal } from '../contracts/ContractModal';
import { PageBackRowSpacer } from '../layout/PageBackLink';
import { DISPUTE_STATUS_CLASS, DISPUTE_STATUS_LABEL, EXCHANGE_STATUS_CLASS, EXCHANGE_STATUS_LABEL, formatDateFr } from '../../lib/labels';

export type PartyUser = { id: string; display_name: string; avatar_url?: string | null; status?: 'active' | 'deleted' };

export type ExchangeWithDetails = Exchange & {
  contract?:
    | (Contract & {
        proposal?: {
          id: string;
          listing_id: string;
          from_user_id: string;
          to_user_id: string;
          from_user?: PartyUser | null;
          to_user?: PartyUser | null;
          listing?: { id: string; title: string; type?: 'service' | 'product'; description_offer?: string; desired_exchange_desc?: string; media?: { url: string }[] } | null;
        } | null;
      })
    | null;
  dispute?: Pick<Dispute, 'id' | 'exchange_id' | 'opened_by' | 'reason' | 'status' | 'resolution' | 'resolved_at' | 'created_at'> | null;
};

type ExchangesPageProps = {
  onUserClick?: (userId: string) => void;
  onStartNewExchange?: () => void;
};

/**
 * Un échange peut porter plusieurs litiges (un seul ouvert à la fois) : on montre celui qui est
 * ouvert, sinon le plus récent. L'embed PostgREST ne garantit aucun ordre.
 */
function pickRelevantDispute(raw: unknown): ExchangeWithDetails['dispute'] {
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as NonNullable<ExchangeWithDetails['dispute']>[];
  if (list.length === 0) return null;
  const open = list.find((d) => d.status === 'open' || d.status === 'in_review');
  if (open) return open;
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
}

/** Les notes internes de modération (resolution_notes) ne sont jamais demandées ici. */
const EXCHANGE_SELECT = `
  *,
  dispute:disputes(id, exchange_id, opened_by, reason, status, resolution, resolved_at, created_at, updated_at),
  contract:contracts(
    id, proposal_id, version, html_content, status, accepted_by_from_at, accepted_by_to_at, created_at, updated_at,
    proposal:proposals(
      id, listing_id, from_user_id, to_user_id,
      from_user:public_profiles!proposals_from_user_id_fkey(id, display_name, avatar_url, status),
      to_user:public_profiles!proposals_to_user_id_fkey(id, display_name, avatar_url, status),
      listing:listings(id, title, type, description_offer, desired_exchange_desc, media:listing_media(url))
    )
  )
`;

export function ExchangesPage({ onUserClick, onStartNewExchange }: ExchangesPageProps) {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeWithDetails[]>([]);
  const [reviewedExchangeIds, setReviewedExchangeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedExchangeId, setSelectedExchangeId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | ExchangeStatus>('all');

  const userId = user?.id;

  const loadExchanges = useCallback(async () => {
    if (!userId) return;
    setLoadError('');
    try {
      // Filtrage côté serveur en trois requêtes simples : mes propositions → leurs contrats → les échanges.
      const { data: myProposals, error: pErr } = await supabase
        .from('proposals')
        .select('id')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .eq('status', 'accepted')
        .limit(500);
      if (pErr) throw pErr;
      const proposalIds = (myProposals ?? []).map((p) => p.id as string);
      let contractIds: string[] = [];
      if (proposalIds.length > 0) {
        const { data: myContracts, error: cErr } = await supabase.from('contracts').select('id').in('proposal_id', proposalIds).limit(500);
        if (cErr) throw cErr;
        contractIds = (myContracts ?? []).map((c) => c.id as string);
      }
      const [{ data, error }, { data: reviews }] = await Promise.all([
        contractIds.length > 0
          ? supabase.from('exchanges').select(EXCHANGE_SELECT).in('contract_id', contractIds).order('created_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('reviews').select('exchange_id').eq('reviewer_id', userId),
      ]);
      if (error) throw error;

      const mine = ((data as unknown as (ExchangeWithDetails & { dispute?: unknown })[]) || [])
        .filter((ex) => {
          const p = ex.contract?.proposal;
          return p && (p.from_user_id === userId || p.to_user_id === userId);
        })
        .map((ex) => ({ ...ex, dispute: pickRelevantDispute(ex.dispute) }));
      setExchanges(mine as ExchangeWithDetails[]);
      setReviewedExchangeIds(new Set((reviews ?? []).map((r) => r.exchange_id as string)));
    } catch (error) {
      setLoadError(errorMessage(error, 'Impossible de charger vos échanges.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadExchanges();
  }, [userId, loadExchanges]);

  const selectedExchange = useMemo(() => exchanges.find((e) => e.id === selectedExchangeId) ?? null, [exchanges, selectedExchangeId]);
  const selectedContract = useMemo(() => exchanges.find((e) => e.contract?.id === selectedContractId)?.contract ?? null, [exchanges, selectedContractId]);

  const getOtherParty = (exchange: ExchangeWithDetails): PartyUser | null => {
    const proposal = exchange.contract?.proposal;
    if (!proposal || !user) return null;
    return (proposal.from_user_id === user.id ? proposal.to_user : proposal.from_user) ?? null;
  };

  const filteredExchanges = useMemo(() => (filterStatus === 'all' ? exchanges : exchanges.filter((ex) => ex.status === filterStatus)), [exchanges, filterStatus]);

  const counts = useMemo(
    () => ({
      all: exchanges.length,
      not_started: exchanges.filter((e) => e.status === 'not_started').length,
      in_progress: exchanges.filter((e) => e.status === 'in_progress').length,
      delivered: exchanges.filter((e) => e.status === 'delivered').length,
      confirmed: exchanges.filter((e) => e.status === 'confirmed').length,
    }),
    [exchanges],
  );

  const filterTabs: { key: 'all' | ExchangeStatus; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: counts.all },
    { key: 'not_started', label: 'À signer', count: counts.not_started },
    { key: 'in_progress', label: 'En cours', count: counts.in_progress },
    { key: 'delivered', label: 'À confirmer', count: counts.delivered },
    { key: 'confirmed', label: 'Terminés', count: counts.confirmed },
  ];

  if (!user) return null;

  const fullPageDetail = Boolean(selectedContract || (selectedExchange && (showReviewModal || true)));

  return (
    <div className="relative w-full">
      {fullPageDetail && selectedContract ? (
        <ContractModal
          contract={selectedContract}
          onClose={() => setSelectedContractId(null)}
          onAccepted={loadExchanges}
        />
      ) : fullPageDetail && selectedExchange && showReviewModal ? (
        <ReviewModal
          exchange={selectedExchange}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedExchangeId(null);
          }}
          onSuccess={loadExchanges}
        />
      ) : fullPageDetail && selectedExchange ? (
        <ExchangeTracker
          exchange={selectedExchange}
          onClose={() => setSelectedExchangeId(null)}
          onUpdate={loadExchanges}
          onOpenContract={() => {
            if (selectedExchange.contract?.id) setSelectedContractId(selectedExchange.contract.id);
          }}
        />
      ) : (
        <>
          <PageBackRowSpacer />
          <section className="mb-10 md:mb-12">
            <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">Mes échanges</h1>
            <p className="font-inter text-base text-on-surface-variant opacity-90 md:text-lg">Signez le contrat, suivez la remise, confirmez et laissez un avis.</p>
          </section>

          <div className="mb-10 flex flex-wrap items-center gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filtrer par statut">
            {filterTabs.map((tab) => {
              const active = filterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`min-h-11 whitespace-nowrap rounded-full px-6 py-3 font-headline text-sm font-bold transition-colors ${
                    active ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {tab.key === 'all' ? `${tab.label} (${tab.count})` : `${tab.label}${tab.count > 0 ? ` (${tab.count})` : ''}`}
                </button>
              );
            })}
          </div>

          {loadError ? (
            <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error-container/30 p-4 text-sm text-on-error-container">
              <span>{loadError}</span>
              <button type="button" onClick={() => void loadExchanges()} className="btn-secondary min-h-10">
                Réessayer
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-20" role="status" aria-label="Chargement">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {filteredExchanges.length === 0 ? (
                <div className="mb-10 rounded-2xl border border-outline-variant/15 bg-surface-container-low py-12 text-center">
                  <span className="material-symbols-outlined mx-auto mb-4 block text-5xl text-outline" aria-hidden>
                    inventory_2
                  </span>
                  <h2 className="font-headline text-lg font-bold text-on-surface">Aucun échange</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {filterStatus === 'all' ? 'Un échange apparaît ici dès qu’une proposition est acceptée.' : `Aucun échange « ${filterTabs.find((t) => t.key === filterStatus)?.label ?? ''} ».`}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {filteredExchanges.map((exchange) => {
                  const otherParty = getOtherParty(exchange);
                  const listing = exchange.contract?.proposal?.listing;
                  const doneLike = exchange.status === 'confirmed' || exchange.status === 'cancelled';
                  const reviewed = reviewedExchangeIds.has(exchange.id);
                  const canClickParty = Boolean(onUserClick && otherParty?.id && otherParty.status !== 'deleted');
                  const contractStatus = exchange.contract?.status;

                  const openProfile = (e: MouseEvent) => {
                    if (canClickParty && otherParty?.id) {
                      e.stopPropagation();
                      onUserClick?.(otherParty.id);
                    }
                  };

                  return (
                    <article
                      key={exchange.id}
                      className={`flex flex-col gap-6 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg transition-all duration-300 ${doneLike ? 'opacity-80 hover:opacity-100' : 'hover:shadow-2xl'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <button
                            type="button"
                            onClick={openProfile}
                            disabled={!canClickParty}
                            className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white ${canClickParty ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                            aria-label={otherParty ? `Voir le profil de ${otherParty.display_name}` : undefined}
                          >
                            {otherParty?.avatar_url ? (
                              <img src={otherParty.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-surface-container-highest font-headline text-lg font-bold text-primary" aria-hidden>
                                {otherParty?.display_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button type="button" onClick={openProfile} disabled={!canClickParty} className={`text-left text-sm font-bold tracking-wide text-primary ${canClickParty ? 'hover:underline' : ''}`}>
                              {otherParty?.display_name ?? 'Membre'}
                            </button>
                            <h2 className="font-headline text-xl font-bold leading-tight text-on-surface">{listing?.title ?? 'Annonce'}</h2>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${EXCHANGE_STATUS_CLASS[exchange.status]}`}>{EXCHANGE_STATUS_LABEL[exchange.status]}</span>
                          {exchange.dispute ? (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${DISPUTE_STATUS_CLASS[exchange.dispute.status]}`}>{DISPUTE_STATUS_LABEL[exchange.dispute.status]}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-y border-outline-variant/10 py-4">
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-outline">Créé le</p>
                          <p className="text-sm font-semibold text-on-surface">{formatDateFr(exchange.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-outline">Contrat</p>
                          <p className="text-sm font-semibold text-on-surface">
                            {contractStatus === 'active' ? 'Signé' : contractStatus === 'completed' ? 'Terminé' : contractStatus === 'cancelled' ? 'Annulé' : 'À signer'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-3">
                        {exchange.contract ? (
                          <button
                            type="button"
                            onClick={() => setSelectedContractId(exchange.contract!.id)}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 font-headline text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest"
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden>
                              description
                            </span>
                            {contractStatus === 'awaiting_signatures' ? 'Signer le contrat' : 'Voir le contrat'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedExchangeId(exchange.id)}
                          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-headline text-xs font-bold text-on-primary transition-colors hover:opacity-95"
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden>
                            trending_up
                          </span>
                          Voir le suivi
                        </button>
                        {exchange.status === 'confirmed' ? (
                          reviewed ? (
                            <span className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 font-headline text-xs font-bold text-on-primary-container">
                              <span className="material-symbols-outlined text-base" aria-hidden>
                                check_circle
                              </span>
                              Avis publié
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedExchangeId(exchange.id);
                                setShowReviewModal(true);
                              }}
                              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 font-headline text-xs font-bold text-on-secondary-container transition-colors hover:brightness-95"
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden>
                                star_half
                              </span>
                              Laisser un avis
                            </button>
                          )
                        ) : null}
                      </div>
                    </article>
                  );
                })}

                <button
                  type="button"
                  onClick={() => onStartNewExchange?.()}
                  className="group flex min-h-11 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-outline-variant/30 p-8 text-center transition-colors hover:border-primary/50"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-outline transition-colors group-hover:bg-primary-fixed">
                    <span className="material-symbols-outlined text-3xl" aria-hidden>
                      add_circle
                    </span>
                  </div>
                  <div>
                    <span className="block font-headline text-lg font-bold text-on-surface">Démarrer un nouvel échange</span>
                    <span className="mt-1 block text-sm text-outline">Parcourez les annonces et faites une proposition</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
