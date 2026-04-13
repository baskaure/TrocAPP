import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { supabase, Listing, Category, Proposal } from './lib/supabase';
import { Header, type AppNavView } from './components/layout/Header';
import { AppSidebar, type AppSidebarActiveItem } from './components/layout/AppSidebar';
import { AppFooter } from './components/layout/AppFooter';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ListingCard } from './components/listings/ListingCard';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { ListingDetailModal } from './components/listings/ListingDetailModal';
import { ProposalsPortal } from './components/proposals/ProposalsPortal';
import { ProposalDetailModal } from './components/proposals/ProposalDetailModal';
import { ProfilePage } from './components/profile/ProfilePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ExchangesPage } from './components/exchanges/ExchangesPage';
import { LandingPage } from './components/home/LandingPage';
import { Filter, Grid } from 'lucide-react';
import { AuthPage } from './components/auth/AuthPage';
import { PublicProfilePage } from './components/profile/PublicProfilePage';
import { AdminPage } from './components/admin/AdminPage';
import { PageBackRowSpacer } from './components/layout/PageBackLink';
import { APP_MAIN_PADDING_TOP_CLASS, APP_SIDEBAR_CONTENT_INSET_LG } from './components/layout/app-layout';

function AppContent() {
  console.log('AppContent rendering...');
  const { user, loading: authLoading } = useAuth();
  console.log('Auth state:', { user: !!user, authLoading });
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposalDetailOptions, setProposalDetailOptions] = useState<{ openChat?: boolean }>({});
  type PrimaryView =
    | 'landing'
    | 'listings'
    | 'proposals'
    | 'profile'
    | 'settings'
    | 'exchanges'
    | 'public-profile'
    | 'admin'
    | 'create-listing'
    | 'listing-detail'
    | 'proposal-detail'
    | 'auth';
  const [view, setView] = useState<PrimaryView>(!user ? 'landing' : 'listings');
  const [pageReturnView, setPageReturnView] = useState<PrimaryView>('listings');
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<
    'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin'
  >('listings');

  // Fonction pour gérer le clic sur un utilisateur
  const handleUserClick = (userId: string) => {
    // Mémoriser la vue actuelle si ce n'est pas déjà 'public-profile'
    if (view !== 'public-profile') {
      setPreviousView(view as 'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin');
    }
    setViewingUserId(userId);
    setSelectedListing(null);
    setSelectedProposal(null);
    setProposalDetailOptions({});
    setView('public-profile');
  };

  const openListingDetail = (listing: Listing) => {
    if (view === 'public-profile') {
      setPageReturnView('public-profile');
    } else {
      setPageReturnView(view);
    }
    setSelectedListing(listing);
    setView('listing-detail');
  };

  const closeListingDetail = () => {
    setSelectedListing(null);
    setView(pageReturnView);
  };

  const openProposalDetail = (p: Proposal, opts?: { openChat?: boolean }) => {
    setPageReturnView(view);
    setSelectedProposal(p);
    setProposalDetailOptions(opts ?? {});
    setView('proposal-detail');
  };

  const closeProposalDetail = () => {
    setSelectedProposal(null);
    setProposalDetailOptions({});
    setView(pageReturnView);
  };

  const closeCreateListing = () => {
    setView(pageReturnView);
  };

  // S'assurer qu'un membre connecté ne voit pas une page vide après refresh :
  // dès que l'auth est chargée et qu'un user existe, on force la vue sur "listings"
  useEffect(() => {
    if (!authLoading && user && view === 'landing') {
      setView('listings');
    }
  }, [authLoading, user, view]);

  useEffect(() => {
    if (view === 'listing-detail' && !selectedListing) {
      setView('listings');
    }
  }, [view, selectedListing]);

  useEffect(() => {
    if (view === 'proposal-detail' && !selectedProposal) {
      setView('proposals');
    }
  }, [view, selectedProposal]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    loadCategories();
    loadListings();
  }, [filterType, filterMode, filterCategory, searchQuery]);

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (data) setCategories(data);
  }

  async function loadListings() {
    setLoading(true);
    try {
      let query = supabase
        .from('listings')
        .select(`
          *,
          user:users(*),
          media:listing_media(*),
          category:categories(name)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterMode !== 'all') {
        query = query.eq('mode', filterMode);
      }

      if (filterCategory) {
        query = query.eq('category_id', filterCategory);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description_offer.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleRequestAuth = useCallback((mode: 'login' | 'register' = 'login') => {
    setPageReturnView(view);
    setAuthModalMode(mode);
    setView('auth');
  }, [view]);

  const openCreateListing = useCallback(() => {
    if (!user) {
      handleRequestAuth('register');
      return;
    }
    setPageReturnView(view);
    setView('create-listing');
  }, [user, view, handleRequestAuth]);

  /** Réinitialise les écrans « détail » pour éviter de mélanger annonce / proposition au changement de section. */
  const clearDetailViews = useCallback(() => {
    setSelectedListing(null);
    setSelectedProposal(null);
    setProposalDetailOptions({});
  }, []);

  const onHeaderLogoClick = useCallback(() => {
    clearDetailViews();
    setView('listings');
  }, [clearDetailViews]);

  const onHeaderNavigate = useCallback(
    (v: AppNavView) => {
      clearDetailViews();
      setView(v);
    },
    [clearDetailViews],
  );

  const sidebarActiveForReturnPage = (rv: PrimaryView): AppSidebarActiveItem => {
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

  const showAppNavSidebar =
    view !== 'public-profile' &&
    (view === 'listings' ||
      (user &&
        [
          'proposals',
          'exchanges',
          'profile',
          'settings',
          'admin',
          'listing-detail',
          'proposal-detail',
          'create-listing',
        ].includes(view)));

  const sidebarActiveItem: AppSidebarActiveItem =
    view === 'proposal-detail'
      ? 'proposals'
      : view === 'listing-detail' || view === 'create-listing'
        ? sidebarActiveForReturnPage(pageReturnView)
        : view === 'listings'
          ? 'explore'
          : view === 'proposals'
            ? 'proposals'
            : view === 'exchanges'
              ? 'exchanges'
              : view === 'profile'
                ? 'profile'
                : view === 'settings'
                  ? 'settings'
                  : view === 'admin'
                    ? 'admin'
                    : 'none';

  const requireUser = (go: () => void) => {
    if (!user) {
      handleRequestAuth('login');
      return;
    }
    go();
  };

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

  const showMobileDock =
    view !== 'public-profile' &&
    view !== 'settings' &&
    view !== 'admin' &&
    view !== 'auth' &&
    [
      'listings',
      'proposals',
      'exchanges',
      'profile',
      'listing-detail',
      'proposal-detail',
      'create-listing',
    ].includes(view);

  /** Marge sous le header + bas de page (dock mobile ou non). */
  const mainContentPadding = showMobileDock
    ? `${APP_MAIN_PADDING_TOP_CLASS} pb-28 md:pb-12`
    : `${APP_MAIN_PADDING_TOP_CLASS} pb-12 md:pb-16`;

  const handleSelectProposal = (p: Proposal, opts?: { openChat?: boolean }) => {
    openProposalDetail(p, opts);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user && view === 'landing') {
    return (
      <LandingPage
        onExplore={() => setView('listings')}
        onCreateAccount={() => {
          setPageReturnView('landing');
          setAuthModalMode('register');
          setView('auth');
        }}
        onLogin={() => {
          setPageReturnView('landing');
          setAuthModalMode('login');
          setView('auth');
        }}
      />
    );
  }

  if (!user && view === 'auth' && pageReturnView === 'landing') {
    return (
      <AuthPage
        variant="standalone"
        initialMode={authModalMode}
        onBack={() => setView('landing')}
        onAuthenticated={() => setView('listings')}
      />
    );
  }

  const filterChip = (active: boolean) =>
    active
      ? 'bg-primary text-on-primary shadow-sm'
      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high';

  const marketplaceTabs = (
    <div className="mb-10 flex gap-4">
      <button
        type="button"
        onClick={() => setView('listings')}
        className={`rounded-full px-8 py-3 font-headline text-sm transition-all ${
          view === 'listings'
            ? 'bg-secondary-container font-extrabold text-on-secondary-container shadow-sm'
            : 'bg-surface-container-low font-bold text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        Annonces
      </button>
      <button
        type="button"
        onClick={() => {
          if (!user) {
            handleRequestAuth('login');
            return;
          }
          setView('proposals');
        }}
        className={`rounded-full px-8 py-3 font-headline text-sm transition-all ${
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
          <div>
            <p className="mb-2 text-sm font-medium text-on-surface-variant">Type</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'service', 'product'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${filterChip(
                    filterType === t,
                  )}`}
                >
                  {t === 'all' ? 'Tous' : t === 'service' ? 'Services' : 'Produits'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-on-surface-variant">Mode</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'remote', 'on_site', 'both'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFilterMode(m)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${filterChip(filterMode === m)}`}
                >
                  {m === 'all'
                    ? 'Tous'
                    : m === 'remote'
                      ? 'À distance'
                      : m === 'on_site'
                        ? 'Sur place'
                        : 'Les deux'}
                </button>
              ))}
            </div>
          </div>
          {categories.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-on-surface-variant">Catégories</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterCategory(null)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${filterChip(filterCategory === null)}`}
                >
                  Toutes
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFilterCategory(category.id)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${filterChip(
                      filterCategory === category.id,
                    )}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Header
        onLogoClick={onHeaderLogoClick}
        onCreateListing={openCreateListing}
        onNavigate={onHeaderNavigate}
        onRequestAuth={handleRequestAuth}
      />

      <AppSidebar
        visible={Boolean(showAppNavSidebar)}
        activeItem={sidebarActiveItem}
        onAnnonces={() => {
          clearDetailViews();
          setView('listings');
          setShowFilters(false);
        }}
        onProposals={() =>
          requireUser(() => {
            clearDetailViews();
            setView('proposals');
          })
        }
        onExchanges={() =>
          requireUser(() => {
            clearDetailViews();
            setView('exchanges');
          })
        }
        onProfile={() =>
          requireUser(() => {
            clearDetailViews();
            setView('profile');
          })
        }
        onSettings={() =>
          requireUser(() => {
            clearDetailViews();
            setView('settings');
          })
        }
        onAdmin={
          user && ['admin', 'moderator'].includes(user.role)
            ? () => {
                clearDetailViews();
                setView('admin');
              }
            : undefined
        }
        showAdmin={!!user && ['admin', 'moderator'].includes(user.role)}
        onSupport={() => {
          window.location.href = 'mailto:contact@bontroc.fr';
        }}
        onCreateListing={openCreateListing}
      />

      <div
        className={`min-w-0 transition-[padding] duration-200 ease-out ${
          showAppNavSidebar ? APP_SIDEBAR_CONTENT_INSET_LG : ''
        }`}
      >
        <main className={`mx-auto max-w-screen-2xl px-6 md:px-8 ${mainContentPadding}`}>
          {view === 'auth' ? (
            <AuthPage
              variant="embedded"
              initialMode={authModalMode}
              onBack={() => setView(pageReturnView)}
              onAuthenticated={() =>
                setView(pageReturnView === 'landing' || pageReturnView === 'auth' ? 'listings' : pageReturnView)
              }
            />
          ) : view === 'create-listing' && user ? (
            <CreateListingModal
              categories={categories}
              onBack={closeCreateListing}
              onSuccess={loadListings}
            />
          ) : view === 'listing-detail' && selectedListing ? (
            <ListingDetailModal
              listing={selectedListing}
              onClose={closeListingDetail}
              onProposalSuccess={loadListings}
              onRequestAuth={handleRequestAuth}
              onUserClick={(userId) => {
                setSelectedListing(null);
                handleUserClick(userId);
              }}
            />
          ) : view === 'proposal-detail' && selectedProposal ? (
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
              onOpenExchanges={() => {
                clearDetailViews();
                setView('exchanges');
              }}
              onOpenProfile={() => {
                clearDetailViews();
                setView('profile');
              }}
            />
          ) : view === 'listings' ? (
            <section>
              <PageBackRowSpacer />
              <header className="mb-16">
                <h1 className="mb-8 font-headline text-5xl font-black leading-[1.1] tracking-tighter text-on-surface md:text-7xl">
                  L&apos;échange <span className="text-primary">intelligent</span>
                  <br />
                  et local.
                </h1>
                <div className="flex max-w-4xl flex-col items-stretch gap-4 md:flex-row">
                  <label className="flex flex-grow cursor-text items-center gap-4 rounded-[2rem] bg-surface-container-low px-6 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="material-symbols-outlined text-outline">search</span>
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Que recherchez-vous ?"
                      className="w-full border-none bg-transparent font-inter text-lg text-on-surface placeholder:text-outline focus:ring-0"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center justify-center gap-2 rounded-[2rem] bg-surface-container-highest px-8 py-4 font-headline font-bold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[22px]">tune</span>
                    Filtres
                  </button>
                </div>
              </header>

              {marketplaceTabs}
              {filtersPanel}

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : listings.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mb-4 text-outline">
                    <Grid className="mx-auto h-16 w-16" />
                  </div>
                  <h3 className="mb-2 font-headline text-xl font-semibold text-on-surface">Aucune annonce trouvée</h3>
                  <p className="mb-6 text-on-surface-variant">Soyez le premier à proposer un échange !</p>
                  {user ? (
                    <button
                      type="button"
                      onClick={openCreateListing}
                      className="rounded-full bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20"
                    >
                      Créer une annonce
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onClick={openListingDetail} />
                  ))}
                </div>
              )}
            </section>
          ) : view === 'proposals' ? (
            <section className="w-full">
              <ProposalsPortal onSelectProposal={handleSelectProposal} />
            </section>
          ) : view === 'profile' ? (
            <ProfilePage onUserClick={handleUserClick} />
          ) : view === 'settings' ? (
            <SettingsPage />
          ) : view === 'exchanges' ? (
            <ExchangesPage
              onUserClick={handleUserClick}
              onStartNewExchange={() => setView('listings')}
            />
          ) : view === 'public-profile' && viewingUserId ? (
            <PublicProfilePage
              userId={viewingUserId}
              backLabel={publicProfileBackLabel}
              onBack={() => {
                setViewingUserId(null);
                setView(previousView);
              }}
              onViewListing={openListingDetail}
              onUserClick={handleUserClick}
            />
          ) : view === 'admin' ? (
            <AdminPage />
          ) : null}
        </main>
      </div>

      <AppFooter />

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
            clearDetailViews();
            setView('listings');
            setShowFilters(false);
          }}
          onCategory={() => {
            clearDetailViews();
            setView('listings');
            setShowFilters((v) => !v);
          }}
          onAdd={openCreateListing}
          onChat={() => {
            if (!user) {
              handleRequestAuth('login');
              return;
            }
            clearDetailViews();
            setView('proposals');
          }}
          onPerson={() => {
            if (!user) {
              handleRequestAuth('login');
              return;
            }
            clearDetailViews();
            setView('profile');
          }}
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
