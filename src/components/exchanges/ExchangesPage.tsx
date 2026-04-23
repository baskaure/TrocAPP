import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Exchange, Contract, Dispute, Proposal } from '../../lib/supabase';
import { ExchangeTracker } from './ExchangeTracker';
import { ReviewModal } from './ReviewModal';
import { ContractModal } from '../contracts/ContractModal';
import { PageBackRowSpacer } from '../layout/PageBackLink';

type PartyUser = { id: string; display_name: string; avatar_url?: string; email?: string };

type ExchangeWithDetails = Exchange & {
  contract?: Contract & {
    proposal?: {
      from_user_id: string;
      to_user_id: string;
      from_user?: PartyUser;
      to_user?: PartyUser;
      listing?: { title: string; type?: 'service' | 'product' };
    };
  };
  dispute?: Dispute | null;
};

type ExchangesPageProps = {
  onUserClick?: (userId: string) => void;
  onStartNewExchange?: () => void;
};

function statusBadgeClass(status: Exchange['status']) {
  switch (status) {
    case 'not_started':
      return 'bg-surface-container-highest text-on-surface-variant';
    case 'in_progress':
      return 'bg-secondary-container text-on-secondary-container';
    case 'delivered':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-100';
    case 'confirmed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'cancelled':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-container-highest text-on-surface-variant';
  }
}

function statusLabel(status: Exchange['status']) {
  const m: Record<Exchange['status'], string> = {
    not_started: 'Non démarré',
    in_progress: 'En cours',
    delivered: 'À confirmer',
    confirmed: 'Terminé',
    cancelled: 'Annulé',
  };
  return m[status] ?? status;
}

export function ExchangesPage({ onUserClick, onStartNewExchange }: ExchangesPageProps) {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeWithDetails | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | Exchange['status']>('all');

  useEffect(() => {
    if (user) loadExchanges();
  }, [user]);

  async function loadExchanges() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          dispute:disputes(*),
          contract:contracts(
            *,
            proposal:proposals(
              *,
              from_user:users!proposals_from_user_id_fkey(id, display_name, avatar_url, email),
              to_user:users!proposals_to_user_id_fkey(id, display_name, avatar_url, email),
              listing:listings(title, type)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered =
        data?.filter((ex: ExchangeWithDetails) => {
          const proposal = ex.contract?.proposal;
          if (!proposal) return false;
          return proposal.from_user_id === user.id || proposal.to_user_id === user.id;
        }) || [];

      const normalized = filtered.map((ex: ExchangeWithDetails & { dispute?: Dispute | Dispute[] }) => ({
        ...ex,
        dispute: Array.isArray(ex.dispute) ? ex.dispute[0] : ex.dispute,
      }));

      setExchanges(normalized as ExchangeWithDetails[]);
    } catch (error) {
      console.error('Error loading exchanges:', error);
    } finally {
      setLoading(false);
    }
  }

  const getOtherParty = (exchange: ExchangeWithDetails): PartyUser | null => {
    const proposal = exchange.contract?.proposal;
    if (!proposal || !user) return null;
    if (proposal.from_user_id === user.id) {
      return proposal.to_user ?? null;
    }
    return proposal.from_user ?? null;
  };

  const filteredExchanges = useMemo(() => {
    if (filterStatus === 'all') return exchanges;
    return exchanges.filter((ex) => ex.status === filterStatus);
  }, [exchanges, filterStatus]);

  const counts = useMemo(() => {
    return {
      all: exchanges.length,
      in_progress: exchanges.filter((e) => e.status === 'in_progress').length,
      delivered: exchanges.filter((e) => e.status === 'delivered').length,
      confirmed: exchanges.filter((e) => e.status === 'confirmed').length,
    };
  }, [exchanges]);

  const canLeaveReview = (exchange: ExchangeWithDetails) => exchange.status === 'confirmed';

  const fullPageExchangeDetail =
    selectedContract != null ||
    showReviewModal ||
    (selectedExchange != null && !showReviewModal && !selectedContract);

  const filterTabs: { key: 'all' | Exchange['status']; label: string; count?: number }[] = [
    { key: 'all', label: 'Tous', count: counts.all },
    { key: 'in_progress', label: 'En cours', count: counts.in_progress },
    { key: 'delivered', label: 'À confirmer', count: counts.delivered },
    { key: 'confirmed', label: 'Terminés', count: counts.confirmed },
  ];

  if (!user) {
    return (
      <div className="w-full py-12 text-center text-on-surface-variant">
        <p className="font-headline text-lg font-semibold text-on-surface">Connexion requise</p>
        <p className="mt-2 text-sm">Connectez-vous pour voir vos échanges.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {fullPageExchangeDetail ? (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {selectedExchange && !showReviewModal && !selectedContract ? (
              <ExchangeTracker
                exchange={selectedExchange}
                onClose={() => setSelectedExchange(null)}
                onUpdate={loadExchanges}
              />
            ) : null}
            {showReviewModal && selectedExchange ? (
              <ReviewModal
                exchange={selectedExchange}
                onClose={() => {
                  setShowReviewModal(false);
                  setSelectedExchange(null);
                }}
                onSuccess={loadExchanges}
              />
            ) : null}
            {selectedContract ? (
              <ContractModal
                contract={selectedContract as Contract & { proposal?: Partial<Proposal> }}
                onClose={() => setSelectedContract(null)}
                onAccepted={loadExchanges}
              />
            ) : null}
          </>
        )
      ) : (
        <>
          <PageBackRowSpacer />
          <section className="mb-12">
            <h1 className="mb-2 font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
              Mes échanges
            </h1>
            <p className="font-inter text-lg text-on-surface-variant opacity-90">
              Suivez l&apos;état de vos échanges en cours et passés
            </p>
          </section>

          <div className="mb-10 flex flex-wrap items-center gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterTabs.map((tab) => {
              const active = filterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterStatus(tab.key)}
                  className={`whitespace-nowrap rounded-full px-6 py-3 font-headline text-sm font-bold transition-colors ${
                    active
                      ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.key === 'all'
                    ? `${tab.label} (${tab.count ?? 0})`
                    : `${tab.label}${tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}`}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            <>
          {filteredExchanges.length === 0 ? (
            <div className="mb-10 rounded-xl border border-outline-variant/20 bg-surface-container-low/80 py-12 text-center dark:bg-slate-900/40">
              <span className="material-symbols-outlined mx-auto mb-4 block text-5xl text-outline">inventory_2</span>
              <h3 className="font-headline text-lg font-bold text-on-surface">Aucun échange</h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                {filterStatus === 'all'
                  ? "Vous n'avez pas encore d'échange."
                  : `Aucun échange dans la catégorie « ${filterTabs.find((t) => t.key === filterStatus)?.label ?? ''} ».`}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {filteredExchanges.map((exchange) => {
              const otherParty = getOtherParty(exchange);
              const proposal = exchange.contract?.proposal;
              const listing = proposal?.listing;
              const doneLike = exchange.status === 'confirmed' || exchange.status === 'cancelled';

              const openProfile = (e: MouseEvent) => {
                if (onUserClick && otherParty?.id) {
                  e.stopPropagation();
                  onUserClick(otherParty.id);
                }
              };

              return (
                <div
                  key={exchange.id}
                  className={`glass-card flex flex-col gap-6 rounded-xl border border-white/40 p-8 shadow-xl shadow-slate-200/40 transition-all duration-300 dark:border-white/10 dark:shadow-none ${
                    doneLike ? 'opacity-80 hover:opacity-100' : 'group hover:shadow-2xl'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <button
                        type="button"
                        onClick={openProfile}
                        disabled={!onUserClick || !otherParty?.id}
                        className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white dark:border-slate-700 ${
                          onUserClick && otherParty?.id ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                        }`}
                      >
                        {otherParty?.avatar_url ? (
                          <img
                            src={otherParty.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-surface-container-highest font-headline text-lg font-bold text-primary">
                            {otherParty?.display_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={openProfile}
                          disabled={!onUserClick || !otherParty?.id}
                          className={`text-left text-sm font-bold tracking-wide text-primary ${
                            onUserClick && otherParty?.id ? 'hover:underline' : ''
                          }`}
                        >
                          {otherParty?.display_name ?? 'Utilisateur'}
                        </button>
                        <h3 className="font-headline text-xl font-bold leading-tight text-on-surface">
                          {listing?.title ?? 'Annonce'}
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusBadgeClass(exchange.status)}`}
                      >
                        {statusLabel(exchange.status)}
                      </span>
                      {exchange.dispute ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            exchange.dispute.status === 'resolved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          Litige {exchange.dispute.status === 'resolved' ? 'résolu' : 'en cours'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-y border-outline-variant/10 py-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-outline">
                        Date de création
                      </p>
                      <p className="text-sm font-semibold text-on-surface">
                        {new Date(exchange.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-outline">Échéance</p>
                      <p className="text-sm font-semibold text-on-surface">
                        {exchange.due_date
                          ? new Date(exchange.due_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-3">
                    {exchange.contract ? (
                      <button
                        type="button"
                        onClick={() => setSelectedContract(exchange.contract as Contract)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container-high px-4 py-3 font-headline text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <span className="material-symbols-outlined text-base">description</span>
                        Voir le contrat
                      </button>
                    ) : null}
                    {canLeaveReview(exchange) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExchange(exchange);
                          setShowReviewModal(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 font-headline text-xs font-bold text-on-secondary-container transition-colors hover:brightness-95"
                      >
                        <span className="material-symbols-outlined text-base">star_half</span>
                        Laisser un avis
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedExchange(exchange)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-headline text-xs font-bold text-on-primary transition-colors hover:opacity-95"
                      >
                        <span className="material-symbols-outlined text-base">trending_up</span>
                        Voir le suivi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => onStartNewExchange?.()}
              className="group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-outline-variant/30 p-8 text-center transition-colors hover:border-primary/50 dark:border-slate-600 dark:hover:border-primary/40"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-outline transition-colors group-hover:bg-primary-fixed dark:bg-slate-800">
                <span className="material-symbols-outlined text-3xl">add_circle</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Démarrer un nouvel échange</h4>
                <p className="mt-1 text-sm text-outline">Proposez vos services ou demandez un coup de main</p>
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
