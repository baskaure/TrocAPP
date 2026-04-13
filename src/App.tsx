import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { supabase, Listing, Category, Proposal } from './lib/supabase';
import { Header } from './components/layout/Header';
import { AppSidebar } from './components/layout/AppSidebar';
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
import { AuthModal } from './components/auth/AuthModal';
import { PublicProfilePage } from './components/profile/PublicProfilePage';
import { AdminPage } from './components/admin/AdminPage';

function AppContent() {
  console.log('AppContent rendering...');
  const { user, loading: authLoading } = useAuth();
  console.log('Auth state:', { user: !!user, authLoading });
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposalDetailOptions, setProposalDetailOptions] = useState<{ openChat?: boolean }>({});
  const [view, setView] = useState<'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'public-profile' | 'admin'>(!user ? 'landing' : 'listings');
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin'>('listings');

  // Fonction pour gérer le clic sur un utilisateur
  const handleUserClick = (userId: string) => {
    // Mémoriser la vue actuelle si ce n'est pas déjà 'public-profile'
    if (view !== 'public-profile') {
      setPreviousView(view as 'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin');
    }
    setViewingUserId(userId);
    setView('public-profile');
  };

  // S'assurer qu'un membre connecté ne voit pas une page vide après refresh :
  // dès que l'auth est chargée et qu'un user existe, on force la vue sur "listings"
  useEffect(() => {
    if (!authLoading && user && view === 'landing') {
      setView('listings');
    }
  }, [authLoading, user, view]);

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

  const handleRequestAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const openCreateListing = () => {
    if (!user) {
      handleRequestAuth('register');
      return;
    }
    setShowCreateModal(true);
  };

  const showMarketplaceChrome = view === 'listings' || view === 'proposals';
  const showAppNavSidebar =
    view !== 'public-profile' &&
    (view === 'listings' ||
      (user && ['proposals', 'exchanges', 'profile', 'settings', 'admin'].includes(view)));

  const sidebarActiveItem =
    view === 'listings'
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

  const showMobileDock =
    view !== 'public-profile' &&
    view !== 'settings' &&
    view !== 'admin' &&
    ['listings', 'proposals', 'exchanges', 'profile'].includes(view);

  /** Même écart sous le header que Propositions / Échanges (pas de dock mobile sur Paramètres). */
  const mainContentPadding =
    showMarketplaceChrome || showMobileDock
      ? 'pb-28 pt-28 md:pb-20'
      : view === 'settings'
        ? 'pt-28 pb-24 md:pb-24'
        : 'py-24';

  const handleSelectProposal = (p: Proposal, opts?: { openChat?: boolean }) => {
    setSelectedProposal(p);
    setProposalDetailOptions(opts ?? {});
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
      <div className="min-h-screen">
        <LandingPage
          onExplore={() => setView('listings')}
          onCreateAccount={() => {
            setView('listings');
            setAuthModalMode('register');
            setShowAuthModal(true);
          }}
          onLogin={() => {
            setView('listings');
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authModalMode}
        />
      </div>
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
        onLogoClick={() => setView('listings')}
        onCreateListing={openCreateListing}
        onNavigate={(v) => setView(v)}
        onRequestAuth={handleRequestAuth}
      />

      {showAppNavSidebar ? (
        <AppSidebar
          activeItem={sidebarActiveItem}
          onAnnonces={() => {
            setView('listings');
            setShowFilters(false);
          }}
          onProposals={() => requireUser(() => setView('proposals'))}
          onExchanges={() => requireUser(() => setView('exchanges'))}
          onProfile={() => requireUser(() => setView('profile'))}
          onSettings={() => requireUser(() => setView('settings'))}
          onAdmin={user && ['admin', 'moderator'].includes(user.role) ? () => setView('admin') : undefined}
          showAdmin={!!user && ['admin', 'moderator'].includes(user.role)}
          onSupport={() => {
            window.location.href = 'mailto:contact@bontroc.fr';
          }}
          onCreateListing={openCreateListing}
        />
      ) : null}

      <div className={showAppNavSidebar ? 'lg:pl-64' : ''}>
        <main className={`mx-auto max-w-screen-2xl px-6 md:px-8 ${mainContentPadding}`}>
          {view === 'listings' ? (
            <section>
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
                    <ListingCard key={listing.id} listing={listing} onClick={setSelectedListing} />
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
              onBack={() => {
                setViewingUserId(null);
                setView(previousView);
              }}
              onViewListing={setSelectedListing}
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
              : view === 'proposals' || view === 'exchanges'
                ? 'chat'
                : showFilters
                  ? 'category'
                  : 'explore'
          }
          onExplore={() => {
            setView('listings');
            setShowFilters(false);
          }}
          onCategory={() => {
            setView('listings');
            setShowFilters((v) => !v);
          }}
          onAdd={openCreateListing}
          onChat={() => {
            if (!user) {
              handleRequestAuth('login');
              return;
            }
            setView('proposals');
          }}
          onPerson={() => {
            if (!user) {
              handleRequestAuth('login');
              return;
            }
            setView('profile');
          }}
        />
      ) : null}

      <CreateListingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadListings}
        categories={categories}
      />

      <ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onProposalSuccess={loadListings}
        onRequestAuth={handleRequestAuth}
        onUserClick={(userId) => {
          setSelectedListing(null);
          handleUserClick(userId);
        }}
      />

      <ProposalDetailModal
        proposal={selectedProposal}
        initialFocusChat={proposalDetailOptions.openChat === true}
        onClose={() => {
          setSelectedProposal(null);
          setProposalDetailOptions({});
        }}
        onUpdate={loadListings}
        onUserClick={(userId) => {
          setSelectedProposal(null);
          setProposalDetailOptions({});
          handleUserClick(userId);
        }}
        onOpenExchanges={() => setView('exchanges')}
        onOpenProfile={() => setView('profile')}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
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
