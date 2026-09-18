import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { supabase, Listing, Category, Proposal } from './lib/supabase';
import { Header, type AppNavView } from './components/layout/Header';
import { AppSidebar, type AppSidebarActiveItem } from './components/layout/AppSidebar';
import { AppFooter } from './components/layout/AppFooter';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ListingCard } from './components/listings/ListingCard';
import { ProposalsPortal } from './components/proposals/ProposalsPortal';
import { PageBackRowSpacer } from './components/layout/PageBackLink';
import { APP_MAIN_PADDING_TOP_CLASS, APP_SIDEBAR_CONTENT_INSET_LG } from './components/layout/app-layout';
import { useNotice } from './components/ui/Toast';
import { currentRoute, currentSearchTerm, parsePath, pushRoute, titleFor, type LegalSection, type Route } from './lib/router';
import { LISTING_SELECT, PROPOSAL_SELECT } from './lib/queries';
import { Filter, Grid } from 'lucide-react';

// Vues chargées à la demande : la landing (framer-motion), la fiche annonce (Leaflet), l'admin…
const LandingPage = lazy(() => import('./components/home/LandingPage').then((m) => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const ResetPasswordPage = lazy(() => import('./components/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const CreateListingModal = lazy(() => import('./components/listings/CreateListingModal').then((m) => ({ default: m.CreateListingModal })));
const ListingDetailModal = lazy(() => import('./components/listings/ListingDetailModal').then((m) => ({ default: m.ListingDetailModal })));
const ProposalDetailModal = lazy(() => import('./components/proposals/ProposalDetailModal').then((m) => ({ default: m.ProposalDetailModal })));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const PublicProfilePage = lazy(() => import('./components/profile/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ExchangesPage = lazy(() => import('./components/exchanges/ExchangesPage').then((m) => ({ default: m.ExchangesPage })));
const AdminPage = lazy(() => import('./components/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const LegalPage = lazy(() => import('./components/legal/LegalPage').then((m) => ({ default: m.LegalPage })));

type PrimaryView = Route['view'];

const AUTH_REQUIRED: ReadonlySet<PrimaryView> = new Set<PrimaryView>([
  'proposals',
  'proposal-detail',
  'exchanges',
  'profile',
  'settings',
  'admin',
  'create-listing',
]);

const PAGE_SIZE = 24;

function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Chargement">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function AppContent() {
  const { user, loading: authLoading, authNotice, clearAuthNotice, passwordRecovery } = useAuth();
  const { toast } = useNotice();

  const initialRoute = useRef(currentRoute()).current;

  const [view, setView] = useState<PrimaryView>(initialRoute.view);
  const [pageReturnView, setPageReturnView] = useState<PrimaryView>('listings');
  const [previousView, setPreviousView] = useState<PrimaryView>('listings');
  const [detailListingId, setDetailListingId] = useState<string | null>(initialRoute.view === 'listing-detail' ? initialRoute.id : null);
  const [detailProposalId, setDetailProposalId] = useState<string | null>(initialRoute.view === 'proposal-detail' ? initialRoute.id : null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(initialRoute.view === 'public-profile' ? initialRoute.id : null);
  const [legalSection, setLegalSection] = useState<LegalSection>(initialRoute.view === 'legal' ? initialRoute.section : 'mentions-legales');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>(initialRoute.view === 'auth' ? initialRoute.mode : 'login');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposalDetailOptions, setProposalDetailOptions] = useState<{ openChat?: boolean }>({});
  const replaceNextRef = useRef(false);
  const firstSyncRef = useRef(true);
  const skipScrollRef = useRef(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsTotal, setListingsTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(() => currentSearchTerm());
  const [searchQuery, setSearchQuery] = useState(() => currentSearchTerm());
  const [showFilters, setShowFilters] = useState(false);
  const listingsRequestIdRef = useRef(0);

  // ── Routage ────────────────────────────────────────────────────────────────
  const routeFromState = useCallback((): Route => {
    switch (view) {
      case 'listing-detail':
        return detailListingId ? { view, id: detailListingId } : { view: 'listings' };
      case 'proposal-detail':
        return detailProposalId ? { view, id: detailProposalId } : { view: 'proposals' };
      case 'public-profile':
        return viewingUserId ? { view, id: viewingUserId } : { view: 'listings' };
      case 'legal':
        return { view, section: legalSection };
      case 'auth':
        return { view, mode: authModalMode };
      default:
        return { view } as Route;
    }
  }, [view, detailListingId, detailProposalId, viewingUserId, legalSection, authModalMode]);

  const applyRoute = useCallback((r: Route) => {
    switch (r.view) {
      case 'listing-detail':
        setDetailListingId(r.id);
        setSelectedListing((cur) => (cur?.id === r.id ? cur : null));
        break;
      case 'proposal-detail':
        setDetailProposalId(r.id);
        setSelectedProposal((cur) => (cur?.id === r.id ? cur : null));
        break;
      case 'public-profile':
        setViewingUserId(r.id);
        break;
      case 'legal':
        setLegalSection(r.section);
        break;
      case 'auth':
        setAuthModalMode(r.mode);
        break;
      default:
        break;
    }
    setView(r.view);
  }, []);

  const navigate = useCallback(
    (r: Route, options?: { replace?: boolean }) => {
      if (options?.replace) replaceNextRef.current = true;
      applyRoute(r);
    },
    [applyRoute],
  );

  // URL + titre synchronisés avec l'état.
  useEffect(() => {
    const r = routeFromState();
    // Premier rendu : un alias (`/exchanges`) ou une URL non normalisée est corrigé par
    // remplacement, sinon le bouton « Précédent » y revient sans effet visible.
    pushRoute(r, replaceNextRef.current || firstSyncRef.current, searchQuery);
    firstSyncRef.current = false;
    replaceNextRef.current = false;
    const detail =
      r.view === 'listing-detail'
        ? selectedListing?.title
        : r.view === 'proposal-detail'
          ? selectedProposal?.listing?.title
          : undefined;
    document.title = titleFor(r, detail);
  }, [routeFromState, searchQuery, selectedListing?.title, selectedProposal?.listing?.title]);

  // Bouton retour / avant du navigateur.
  useEffect(() => {
    const onPop = () => {
      // Le navigateur restaure lui-même la position : on ne remonte pas en haut.
      skipScrollRef.current = true;
      applyRoute(parsePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute]);

  // Haut de page à chaque changement de vue, sauf navigation d'historique.
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [view, detailListingId, detailProposalId, viewingUserId]);

  // Message conservé d'une session à l'autre (suppression de compte, qui recharge la page).
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('bontroc:notice');
      if (pending) {
        sessionStorage.removeItem('bontroc:notice');
        toast.success(pending);
      }
    } catch {
      /* stockage indisponible */
    }
  }, [toast]);

  const clearDetailViews = useCallback(() => {
    setSelectedListing(null);
    setSelectedProposal(null);
    setDetailListingId(null);
    setDetailProposalId(null);
    setProposalDetailOptions({});
  }, []);

  // Avis du contexte d'auth (compte suspendu, supprimé…).
  useEffect(() => {
    if (!authNotice) return;
    if (authNotice.kind === 'info') toast.success(authNotice.message);
    else toast.error(authNotice.message);
    clearAuthNotice();
  }, [authNotice, clearAuthNotice, toast]);

  // Lien de réinitialisation de mot de passe.
  useEffect(() => {
    if (passwordRecovery && view !== 'reset-password') navigate({ view: 'reset-password' }, { replace: true });
  }, [passwordRecovery, view, navigate]);

  // Membre connecté : la landing devient le fil des annonces.
  useEffect(() => {
    if (!authLoading && user && view === 'landing') navigate({ view: 'listings' }, { replace: true });
  }, [authLoading, user, view, navigate]);

  // Authentification réussie sur la page d'auth : retour à la vue demandée.
  useEffect(() => {
    if (!authLoading && user && view === 'auth') {
      const target: Route =
        pageReturnView === 'landing' || pageReturnView === 'auth' ? { view: 'listings' } : ({ view: pageReturnView } as Route);
      navigate(target, { replace: true });
    }
  }, [authLoading, user, view, pageReturnView, navigate]);

  // Vue réservée aux membres sans session : on passe par la connexion puis on revient.
  // Après une déconnexion volontaire, on renvoie plutôt au marché : réafficher le formulaire
  // de connexion donnerait l'impression que la déconnexion a échoué.
  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (user) wasAuthenticatedRef.current = true;
  }, [user]);
  useEffect(() => {
    if (authLoading || user || !AUTH_REQUIRED.has(view)) return;
    if (wasAuthenticatedRef.current) {
      wasAuthenticatedRef.current = false;
      clearDetailViews();
      navigate({ view: 'listings' }, { replace: true });
      return;
    }
    setPageReturnView(view);
    setAuthModalMode('login');
    navigate({ view: 'auth', mode: 'login' }, { replace: true });
  }, [authLoading, user, view, navigate, clearDetailViews]);

  // ── Données ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const buildListingsQuery = useCallback(
    (from: number, to: number) => {
      let query = supabase
        .from('listings')
        .select(LISTING_SELECT, { count: 'exact' })
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filterType !== 'all') query = query.eq('type', filterType);
      if (filterMode !== 'all') query = query.eq('mode', filterMode);
      if (filterCategory) query = query.eq('category_id', filterCategory);

      // Neutralise la syntaxe PostgREST pour ne pas casser le filtre .or()
      const sanitizedSearch = searchQuery.replace(/[,()"'\\%]/g, ' ').trim().slice(0, 100);
      if (sanitizedSearch) {
        query = query.or(`title.ilike.%${sanitizedSearch}%,description_offer.ilike.%${sanitizedSearch}%`);
      }
      return query;
    },
    [filterType, filterMode, filterCategory, searchQuery],
  );

  const loadListings = useCallback(async () => {
    const requestId = ++listingsRequestIdRef.current;
    setLoading(true);
    try {
      const { data, error, count } = await buildListingsQuery(0, PAGE_SIZE - 1);
      if (requestId !== listingsRequestIdRef.current) return;
      if (error) throw error;
      setListings((data as unknown as Listing[]) || []);
      setListingsTotal(count ?? null);
    } catch (error) {
      console.error('Chargement des annonces impossible :', error);
      toast.error('Impossible de charger les annonces pour le moment.');
    } finally {
      if (requestId === listingsRequestIdRef.current) setLoading(false);
    }
  }, [buildListingsQuery, toast]);

  const loadMoreListings = useCallback(async () => {
    const requestId = listingsRequestIdRef.current;
    setLoadingMore(true);
    try {
      const from = listings.length;
      const { data, error } = await buildListingsQuery(from, from + PAGE_SIZE - 1);
      // Les filtres ont changé entre-temps : cette page appartient à l'ancienne recherche.
      if (requestId !== listingsRequestIdRef.current) return;
      if (error) throw error;
      setListings((prev) => {
        const known = new Set(prev.map((l) => l.id));
        return [...prev, ...((data as unknown as Listing[]) || []).filter((l) => !known.has(l.id))];
      });
    } catch (error) {
      console.error('Chargement des annonces suivantes impossible :', error);
      toast.error('Impossible de charger la suite.');
    } finally {
      setLoadingMore(false);
    }
  }, [buildListingsQuery, listings.length, toast]);

  const needsListings = view === 'listings' || view === 'listing-detail';
  useEffect(() => {
    if (!needsListings) return;
    void loadListings();
  }, [needsListings, loadListings]);

  // Fiche annonce ouverte par URL : on la charge.
  useEffect(() => {
    if (view !== 'listing-detail' || !detailListingId || selectedListing?.id === detailListingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from('listings').select(LISTING_SELECT).eq('id', detailListingId).maybeSingle();
        if (cancelled) return;
        if (data) {
          setSelectedListing(data as unknown as Listing);
        } else if (error) {
          // Réseau, RLS ou cache de schéma : l'annonce existe peut-être, on ne redirige pas.
          toast.error('Chargement de l’annonce impossible. Réessayez dans un instant.');
        } else {
          toast.error('Cette annonce n’existe plus.');
          navigate({ view: 'listings' }, { replace: true });
        }
      } catch {
        if (!cancelled) toast.error('Chargement de l’annonce impossible. Vérifiez votre connexion.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, detailListingId, selectedListing?.id, navigate, toast]);

  // Proposition ouverte par URL.
  useEffect(() => {
    if (view !== 'proposal-detail' || !detailProposalId || !user || selectedProposal?.id === detailProposalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from('proposals').select(PROPOSAL_SELECT).eq('id', detailProposalId).maybeSingle();
        if (cancelled) return;
        if (data) {
          setSelectedProposal(data as unknown as Proposal);
        } else if (error) {
          toast.error('Chargement de la proposition impossible. Réessayez dans un instant.');
        } else {
          toast.error('Cette proposition est introuvable.');
          navigate({ view: 'proposals' }, { replace: true });
        }
      } catch {
        if (!cancelled) toast.error('Chargement de la proposition impossible. Vérifiez votre connexion.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, detailProposalId, user, selectedProposal?.id, navigate, toast]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleRequestAuth = useCallback(
    (mode: 'login' | 'register' = 'login') => {
      setPageReturnView(view);
      setAuthModalMode(mode);
      navigate({ view: 'auth', mode });
    },
    [view, navigate],
  );

  // `pageReturnView` sert à revenir après authentification : les pages légales ont leur propre
  // retour pour ne pas écraser la destination demandée avant la connexion.
  const [legalReturnView, setLegalReturnView] = useState<PrimaryView>('listings');
  const goLegal = useCallback(
    (section: LegalSection) => {
      if (view !== 'legal') setLegalReturnView(view);
      navigate({ view: 'legal', section });
    },
    [view, navigate],
  );

  const handleUserClick = useCallback(
    (userId: string) => {
      if (view !== 'public-profile') setPreviousView(view);
      setSelectedListing(null);
      setSelectedProposal(null);
      setProposalDetailOptions({});
      navigate({ view: 'public-profile', id: userId });
    },
    [view, navigate],
  );

  /** Recharge la fiche ouverte (après édition) pour ne pas afficher un texte ou une photo périmés. */
  const refreshSelectedListing = useCallback(async () => {
    if (!detailListingId) return;
    const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', detailListingId).maybeSingle();
    if (data) setSelectedListing(data as unknown as Listing);
  }, [detailListingId]);

  const openListingDetail = useCallback(
    (listing: Listing) => {
      setPageReturnView(view === 'public-profile' ? 'public-profile' : view);
      setSelectedListing(listing);
      navigate({ view: 'listing-detail', id: listing.id });
    },
    [view, navigate],
  );

  const closeListingDetail = useCallback(() => {
    setSelectedListing(null);
    setDetailListingId(null);
    navigate({ view: pageReturnView === 'listing-detail' ? 'listings' : pageReturnView } as Route);
  }, [pageReturnView, navigate]);

  const openProposalDetail = useCallback(
    (p: Proposal, opts?: { openChat?: boolean }) => {
      setPageReturnView(view);
      setSelectedProposal(p);
      setProposalDetailOptions(opts ?? {});
      navigate({ view: 'proposal-detail', id: p.id });
    },
    [view, navigate],
  );

  const closeProposalDetail = useCallback(() => {
    setSelectedProposal(null);
    setDetailProposalId(null);
    setProposalDetailOptions({});
    navigate({ view: 'proposals' });
  }, [navigate]);

  const openCreateListing = useCallback(() => {
    if (!user) {
      handleRequestAuth('register');
      return;
    }
    setPageReturnView(view);
    navigate({ view: 'create-listing' });
  }, [user, view, handleRequestAuth, navigate]);

  const closeCreateListing = useCallback(() => {
    navigate({ view: pageReturnView === 'create-listing' ? 'listings' : pageReturnView } as Route);
  }, [pageReturnView, navigate]);

  const goTo = useCallback(
    (v: AppNavView) => {
      clearDetailViews();
      navigate({ view: v });
    },
    [clearDetailViews, navigate],
  );

  const requireUser = useCallback(
    (go: () => void) => {
      if (!user) {
        handleRequestAuth('login');
        return;
      }
      go();
    },
    [user, handleRequestAuth],
  );

  const sidebarActiveItem: AppSidebarActiveItem = useMemo(() => {
    const forReturn = (rv: PrimaryView): AppSidebarActiveItem => {
      switch (rv) {
        case 'proposals':
        case 'proposal-detail':
          return 'proposals';
        case 'exchanges':
          return 'exchanges';
        case 'profile':
        case 'public-profile':
          return 'profile';
        case 'settings':
          return 'settings';
        case 'admin':
          return 'admin';
        default:
          return 'explore';
      }
    };
    if (view === 'proposal-detail') return 'proposals';
    if (view === 'listing-detail' || view === 'create-listing') return forReturn(pageReturnView);
    return forReturn(view);
  }, [view, pageReturnView]);

  const showAppNavSidebar =
    view !== 'public-profile' &&
    view !== 'legal' &&
    (view === 'listings' ||
      view === 'listing-detail' ||
      (Boolean(user) && ['proposals', 'exchanges', 'profile', 'settings', 'admin', 'proposal-detail', 'create-listing'].includes(view)));

  const publicProfileBackLabel = (() => {
    const v = previousView as string;
    if (v === 'listings' || v === 'listing-detail' || v === 'create-listing') return 'Retour aux annonces';
    if (v === 'proposals' || v === 'proposal-detail') return 'Retour aux propositions';
    if (v === 'exchanges') return 'Retour aux échanges';
    if (v === 'profile') return 'Retour au profil';
    if (v === 'settings') return 'Retour aux paramètres';
    if (v === 'admin') return "Retour à l'administration";
    return 'Retour';
  })();

  const showMobileDock = ['listings', 'proposals', 'exchanges', 'profile', 'listing-detail', 'proposal-detail', 'create-listing'].includes(view);

  const mainContentPadding = showMobileDock
    ? `${APP_MAIN_PADDING_TOP_CLASS} pb-28 md:pb-12`
    : `${APP_MAIN_PADDING_TOP_CLASS} pb-12 md:pb-16`;

  // ── Écrans plein cadre ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (view === 'reset-password') {
    return (
      <Suspense fallback={<Spinner />}>
        <ResetPasswordPage onDone={() => navigate({ view: 'listings' }, { replace: true })} onCancel={() => navigate({ view: 'auth', mode: 'login' }, { replace: true })} />
      </Suspense>
    );
  }

  if (!user && view === 'landing') {
    return (
      <Suspense fallback={<Spinner />}>
        <LandingPage
          onExplore={() => navigate({ view: 'listings' })}
          onCreateAccount={() => {
            setPageReturnView('landing');
            setAuthModalMode('register');
            navigate({ view: 'auth', mode: 'register' });
          }}
          onLogin={() => {
            setPageReturnView('landing');
            setAuthModalMode('login');
            navigate({ view: 'auth', mode: 'login' });
          }}
          onLegal={goLegal}
        />
      </Suspense>
    );
  }

  if (!user && view === 'auth') {
    return (
      <Suspense fallback={<Spinner />}>
        <AuthPage
          variant="standalone"
          initialMode={authModalMode}
          onBack={() =>
            navigate({ view: pageReturnView === 'auth' || AUTH_REQUIRED.has(pageReturnView) ? 'listings' : pageReturnView } as Route)
          }
          onModeChange={(mode) => {
            setAuthModalMode(mode);
            pushRoute({ view: 'auth', mode }, true);
          }}
          // Pas de navigation ici : l'effet « user && view === 'auth' » redirige une fois le
          // profil chargé, sinon la vue protégée s'afficherait une frame sans utilisateur.
          onAuthenticated={() => undefined}
          onLegal={goLegal}
        />
      </Suspense>
    );
  }

  const filterChip = (active: boolean) =>
    active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high';

  const marketplaceTabs = (
    <div className="mb-10 flex gap-4" role="tablist" aria-label="Sections du marché">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'listings'}
        onClick={() => navigate({ view: 'listings' })}
        className={`min-h-11 rounded-full px-8 py-3 font-headline text-sm transition-all ${
          view === 'listings'
            ? 'bg-secondary-container font-extrabold text-on-secondary-container shadow-sm'
            : 'bg-surface-container-low font-bold text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        Annonces
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'proposals'}
        onClick={() => requireUser(() => navigate({ view: 'proposals' }))}
        className={`min-h-11 rounded-full px-8 py-3 font-headline text-sm transition-all ${
          view === 'proposals'
            ? 'bg-secondary-container font-extrabold text-on-secondary-container shadow-sm'
            : 'bg-surface-container-low font-bold text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        Mes propositions
      </button>
    </div>
  );

  const filtersPanel =
    showFilters && view === 'listings' ? (
      <div className="mb-10 rounded-xl border border-surface-container-high bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-base font-semibold text-on-surface">Filtres</h2>
          <Filter className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-on-surface-variant">Type</legend>
            <div className="flex flex-wrap gap-2">
              {(['all', 'service', 'product'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={filterType === t}
                  onClick={() => setFilterType(t)}
                  className={`min-h-10 rounded-full px-4 py-2 text-sm transition-colors ${filterChip(filterType === t)}`}
                >
                  {t === 'all' ? 'Tous' : t === 'service' ? 'Services' : 'Produits'}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-on-surface-variant">Mode</legend>
            <div className="flex flex-wrap gap-2">
              {(['all', 'remote', 'on_site', 'both'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={filterMode === m}
                  onClick={() => setFilterMode(m)}
                  className={`min-h-10 rounded-full px-4 py-2 text-sm transition-colors ${filterChip(filterMode === m)}`}
                >
                  {m === 'all' ? 'Tous' : m === 'remote' ? 'À distance' : m === 'on_site' ? 'Sur place' : 'Les deux'}
                </button>
              ))}
            </div>
          </fieldset>
          {categories.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-on-surface-variant">Catégories</legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={filterCategory === null}
                  onClick={() => setFilterCategory(null)}
                  className={`min-h-10 rounded-full px-4 py-1 text-sm transition-colors ${filterChip(filterCategory === null)}`}
                >
                  Toutes
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={filterCategory === category.id}
                    onClick={() => setFilterCategory(category.id)}
                    className={`min-h-10 rounded-full px-4 py-1 text-sm transition-colors ${filterChip(filterCategory === category.id)}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      </div>
    ) : null;

  const hasMore = listingsTotal !== null && listings.length < listingsTotal;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <Header onLogoClick={() => goTo('listings')} onCreateListing={openCreateListing} onNavigate={goTo} onRequestAuth={handleRequestAuth} />

      <AppSidebar
        visible={Boolean(showAppNavSidebar)}
        activeItem={sidebarActiveItem}
        onAnnonces={() => {
          goTo('listings');
          setShowFilters(false);
        }}
        onProposals={() => requireUser(() => goTo('proposals'))}
        onExchanges={() => requireUser(() => goTo('exchanges'))}
        onProfile={() => requireUser(() => goTo('profile'))}
        onSettings={() => requireUser(() => goTo('settings'))}
        onAdmin={user && ['admin', 'moderator'].includes(user.role) ? () => goTo('admin') : undefined}
        showAdmin={!!user && ['admin', 'moderator'].includes(user.role)}
        onSupport={() => {
          window.location.href = 'mailto:contact@bontroc.fr';
        }}
        onCreateListing={openCreateListing}
      />

      <div className={`min-w-0 transition-[padding] duration-200 ease-out ${showAppNavSidebar ? APP_SIDEBAR_CONTENT_INSET_LG : ''}`}>
        <main id="contenu" className={`mx-auto max-w-screen-2xl px-4 sm:px-6 md:px-8 ${mainContentPadding}`}>
          <Suspense fallback={<Spinner />}>
            {view === 'create-listing' && user ? (
              <CreateListingModal categories={categories} onBack={closeCreateListing} onSuccess={loadListings} />
            ) : view === 'listing-detail' ? (
              selectedListing ? (
                <ListingDetailModal
                  listing={selectedListing}
                  onClose={closeListingDetail}
                  onProposalSuccess={async () => {
                    await refreshSelectedListing();
                    await loadListings();
                  }}
                  onRequestAuth={handleRequestAuth}
                  onUserClick={(userId) => {
                    setSelectedListing(null);
                    handleUserClick(userId);
                  }}
                />
              ) : (
                <Spinner />
              )
            ) : view === 'proposal-detail' && user ? (
              selectedProposal ? (
                <ProposalDetailModal
                  proposal={selectedProposal}
                  initialFocusChat={proposalDetailOptions.openChat === true}
                  onClose={closeProposalDetail}
                  onUpdate={loadListings}
                  onUserClick={(userId) => {
                    setSelectedProposal(null);
                    setProposalDetailOptions({});
                    handleUserClick(userId);
                  }}
                  onOpenExchanges={() => goTo('exchanges')}
                  onOpenProfile={() => goTo('profile')}
                />
              ) : (
                <Spinner />
              )
            ) : view === 'listings' ? (
              <section aria-labelledby="listings-title">
                <PageBackRowSpacer />
                <header className="mb-10 md:mb-12">
                  <h1
                    id="listings-title"
                    className="mb-6 font-headline text-3xl font-extrabold leading-[1.1] tracking-tight text-on-surface sm:text-4xl md:mb-8 md:text-5xl"
                  >
                    L&apos;échange <span className="text-primary">intelligent</span>
                    <br />
                    et local.
                  </h1>
                  <div className="flex max-w-4xl flex-col items-stretch gap-4 md:flex-row">
                    <label className="flex flex-grow cursor-text items-center gap-4 rounded-[2rem] bg-surface-container-low px-6 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                      <span className="material-symbols-outlined text-outline" aria-hidden>
                        search
                      </span>
                      <span className="sr-only">Rechercher une annonce</span>
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Que recherchez-vous ?"
                        maxLength={100}
                        className="w-full border-none bg-transparent font-inter text-lg text-on-surface placeholder:text-outline focus:ring-0"
                        autoComplete="off"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      aria-expanded={showFilters}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-[2rem] bg-surface-container-highest px-8 py-4 font-headline font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[22px]" aria-hidden>
                        tune
                      </span>
                      Filtres
                    </button>
                  </div>
                </header>

                {marketplaceTabs}
                {filtersPanel}

                {loading ? (
                  <Spinner />
                ) : listings.length === 0 ? (
                  <div className="py-16 pb-24 text-center">
                    <div className="mb-4 text-outline">
                      <Grid className="mx-auto h-16 w-16" aria-hidden />
                    </div>
                    <h2 className="mb-2 font-headline text-xl font-semibold text-on-surface">Aucune annonce trouvée</h2>
                    <p className="mb-6 text-on-surface-variant">
                      {searchQuery || filterCategory || filterType !== 'all' || filterMode !== 'all'
                        ? 'Essayez d’autres mots-clés ou retirez un filtre.'
                        : 'Soyez le premier à proposer un échange !'}
                    </p>
                    <button
                      type="button"
                      onClick={openCreateListing}
                      className="min-h-11 rounded-full bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20"
                    >
                      Créer une annonce
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="sr-only" aria-live="polite">
                      {listingsTotal ?? listings.length} annonce{(listingsTotal ?? listings.length) > 1 ? 's' : ''}
                    </p>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                      {listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} onClick={openListingDetail} />
                      ))}
                    </div>
                    {hasMore ? (
                      <div className="mt-12 flex justify-center">
                        <button
                          type="button"
                          onClick={loadMoreListings}
                          disabled={loadingMore}
                          className="btn-secondary min-h-12 px-8 text-base"
                        >
                          {loadingMore ? 'Chargement…' : `Afficher plus d’annonces (${listings.length}/${listingsTotal})`}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            ) : view === 'proposals' && user ? (
              <section className="w-full">
                <ProposalsPortal onSelectProposal={openProposalDetail} />
              </section>
            ) : view === 'profile' && user ? (
              <ProfilePage onUserClick={handleUserClick} />
            ) : view === 'settings' && user ? (
              <SettingsPage onLegal={goLegal} />
            ) : view === 'exchanges' && user ? (
              <ExchangesPage onUserClick={handleUserClick} onStartNewExchange={() => goTo('listings')} />
            ) : view === 'public-profile' && viewingUserId ? (
              <PublicProfilePage
                userId={viewingUserId}
                backLabel={publicProfileBackLabel}
                onBack={() => {
                  setViewingUserId(null);
                  navigate({ view: previousView === 'public-profile' ? 'listings' : previousView } as Route);
                }}
                onViewListing={openListingDetail}
                onUserClick={handleUserClick}
              />
            ) : view === 'admin' && user ? (
              <AdminPage />
            ) : view === 'legal' ? (
              <LegalPage
                section={legalSection}
                onBack={() => navigate({ view: legalReturnView === 'legal' ? 'listings' : legalReturnView } as Route)}
                onNavigate={(s) => navigate({ view: 'legal', section: s })}
              />
            ) : null}
          </Suspense>
        </main>
      </div>

      <AppFooter onLegal={goLegal} />

      {showMobileDock ? (
        <MobileBottomNav
          active={
            view === 'profile'
              ? 'person'
              : view === 'proposals' || view === 'exchanges' || view === 'proposal-detail'
                ? 'chat'
                : showFilters
                  ? 'category'
                  : 'explore'
          }
          onExplore={() => {
            goTo('listings');
            setShowFilters(false);
          }}
          onCategory={() => {
            goTo('listings');
            setShowFilters((v) => !v);
          }}
          onAdd={openCreateListing}
          onChat={() => requireUser(() => goTo('proposals'))}
          onPerson={() => requireUser(() => goTo('profile'))}
        />
      ) : null}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
