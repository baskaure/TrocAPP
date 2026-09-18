import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Proposal } from '../../lib/supabase';
import { PROPOSAL_STATUS_CLASS, PROPOSAL_STATUS_LABEL } from '../../lib/labels';
import { PageBackRowSpacer } from '../layout/PageBackLink';

type ProposalWithListing = Proposal & {
  listing?: Proposal['listing'] & {
    media?: { url: string }[];
    category?: { name: string } | null;
  };
};

type ProposalsPortalProps = {
  onSelectProposal: (proposal: Proposal, options?: { openChat?: boolean }) => void;
};

function formatMonthKey(d: string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function ProposalsPortal({ onSelectProposal }: ProposalsPortalProps) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<ProposalWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [monthKey, setMonthKey] = useState<string | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setMonthKey(null);
  }, [filter]);

  async function loadProposals() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          `
          *,
          from_user:public_profiles!proposals_from_user_id_fkey(*),
          to_user:public_profiles!proposals_to_user_id_fkey(*),
          listing:listings(
            id, user_id, type, title, description_offer, desired_exchange_desc, mode, status, created_at, updated_at, view_count,
            media:listing_media(id, listing_id, url, type, sort_order),
            category:categories(name, slug)
          )
        `,
        )
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setProposals((data as ProposalWithListing[]) || []);
    } catch (e) {
      console.error('Error loading proposals:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredByDirection = useMemo(() => {
    if (!user) return [];
    if (filter === 'sent') return proposals.filter((p) => p.from_user_id === user.id);
    if (filter === 'received') return proposals.filter((p) => p.to_user_id === user.id);
    return proposals;
  }, [proposals, filter, user]);

  const proposalFilterTabs: { key: typeof filter; label: string; count: number }[] = useMemo(() => {
    if (!user) return [];
    const sent = proposals.filter((p) => p.from_user_id === user.id).length;
    const received = proposals.filter((p) => p.to_user_id === user.id).length;
    return [
      { key: 'all', label: 'Toutes', count: proposals.length },
      { key: 'sent', label: 'Envoyées', count: sent },
      { key: 'received', label: 'Reçues', count: received },
    ];
  }, [proposals, user]);

  const monthKeys = useMemo(() => {
    const set = new Set<string>();
    filteredByDirection.forEach((p) => set.add(formatMonthKey(p.created_at)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [filteredByDirection]);

  const filteredByMonth = useMemo(() => {
    if (!monthKey) return filteredByDirection;
    return filteredByDirection.filter((p) => formatMonthKey(p.created_at) === monthKey);
  }, [filteredByDirection, monthKey]);

  const activeCount = useMemo(
    () => proposals.filter((p) => ['pending', 'countered', 'accepted'].includes(p.status)).length,
    [proposals],
  );
  const pendingCount = useMemo(() => proposals.filter((p) => p.status === 'pending').length, [proposals]);

  const firstName = user?.display_name?.split(/\s+/)[0] ?? '';

  const thumbUrl = (p: ProposalWithListing) =>
    p.listing?.media && p.listing.media.length > 0 ? p.listing.media[0].url : null;

  if (!user) return null;

  return (
    <div className="relative min-h-[calc(100dvh-5.5rem)] w-full">
      <PageBackRowSpacer />
      <section className="mb-10 md:mb-12">
        <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
          Mes propositions
        </h1>
        <p className="font-inter text-base text-on-surface-variant opacity-90 md:text-lg">
          Retrouvez vos offres envoyées et reçues, et pilotez vos discussions jusqu&apos;à l&apos;échange.
        </p>
      </section>

      <div className="mb-10 flex flex-wrap items-center gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {proposalFilterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-4 font-headline text-sm font-bold transition-colors ${
                active
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest '
              }`}
            >
              {tab.key === 'all'
                ? `${tab.label} (${tab.count})`
                : `${tab.label}${tab.count > 0 ? ` (${tab.count})` : ''}`}
            </button>
          );
        })}
      </div>

      <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg lg:col-span-8 lg:p-10">
              <div className="relative z-10">
                <h2 className="mb-2 font-headline text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
                  Bonjour{firstName ? `, ${firstName}` : ''}{' '}
                  
                </h2>
                <p className="max-w-md font-inter text-base text-on-surface-variant opacity-90">
                  Voici un aperçu de l&apos;activité de vos propositions.
                </p>
              </div>
              <div className="relative z-10 mt-6 flex flex-wrap gap-4">
                <div className="rounded-lg bg-primary/10 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Actives</span>
                  <p className="font-headline text-2xl font-black text-primary">{activeCount}</p>
                </div>
                <div className="rounded-lg bg-secondary/10 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary">En attente</span>
                  <p className="font-headline text-2xl font-black text-secondary">{pendingCount}</p>
                </div>
              </div>
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            </div>
            <div className="flex flex-col items-center justify-center rounded-3xl bg-secondary-container/40 p-8 text-center lg:col-span-4 lg:p-10">
              <span
                className="material-symbols-outlined mb-4 text-6xl text-on-secondary-container"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                verified
              </span>
              <h3 className="font-headline text-xl font-bold text-on-secondary-container">
                {user.is_verified ? 'Profil vérifié' : 'Vérifiez votre profil'}
              </h3>
              <p className="mt-2 text-sm text-on-secondary-container/80">
                {user.is_verified
                  ? 'Votre compte est certifié auprès de la communauté.'
                  : 'Complétez votre vérification pour renforcer la confiance.'}
              </p>
            </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMonthKey(null)}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold shadow-sm transition-colors ${
                monthKey === null ? 'bg-primary text-on-primary' : 'border border-outline-variant/10 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Tous les mois
            </button>
            {monthKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMonthKey(key)}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold capitalize shadow-sm transition-colors ${
                  monthKey === key
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant/10 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {formatMonthLabel(key)}
              </button>
            ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : filteredByMonth.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined mx-auto mb-4 block text-5xl text-outline">forum</span>
          <p className="font-medium">Aucune proposition pour cette sélection.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredByMonth.map((proposal) => {
                const otherUser = proposal.from_user_id === user.id ? proposal.to_user : proposal.from_user;
                const isSent = proposal.from_user_id === user.id;
                const isReceiver = proposal.to_user_id === user.id;
                const doneLike = proposal.status === 'refused' || proposal.status === 'cancelled';
                const categoryName = proposal.listing?.category?.name;

                return (
                  <div
                    key={proposal.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectProposal(proposal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectProposal(proposal);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-all duration-300 hover:shadow-lg ${
                      doneLike ? 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0' : ''
                    } group`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
                        {thumbUrl(proposal) ? (
                          <img src={thumbUrl(proposal)!} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-3xl text-outline">image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 md:gap-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${PROPOSAL_STATUS_CLASS[proposal.status]}`}
                          >
                            {PROPOSAL_STATUS_LABEL[proposal.status]}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-outline">
                            {isSent ? 'Envoyée' : 'Reçue'}
                          </span>
                        </div>
                        <h3 className="font-headline text-base font-bold leading-tight text-on-surface md:text-lg line-clamp-2">
                          {proposal.listing?.title ?? 'Sans titre'}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium text-on-surface-variant md:gap-4">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            {otherUser?.display_name ?? '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            {new Date(proposal.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          {categoryName ? (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">tag</span>
                              {categoryName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex flex-shrink-0 gap-2 pl-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {proposal.status === 'pending' && isReceiver ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelectProposal(proposal)}
                            className="min-h-10 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-colors hover:opacity-95"
                          >
                            Répondre
                          </button>
                        </>
                      ) : proposal.status === 'accepted' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelectProposal(proposal)}
                            className="min-h-10 rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            Détails
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectProposal(proposal, { openChat: true })}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-fixed"
                            aria-label="Ouvrir la discussion"
                          >
                            <span className="material-symbols-outlined" aria-hidden>chat</span>
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
          })}
        </div>
      )}
    </div>
  );
}
