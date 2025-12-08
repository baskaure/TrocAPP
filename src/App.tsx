import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { supabase, Listing, Category, Proposal } from './lib/supabase';
import { Header } from './components/layout/Header';
import { ListingCard } from './components/listings/ListingCard';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { ListingDetailModal } from './components/listings/ListingDetailModal';
import { ProposalsList } from './components/proposals/ProposalsList';
import { ProposalDetailModal } from './components/proposals/ProposalDetailModal';
import { ProfilePage } from './components/profile/ProfilePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ExchangesPage } from './components/exchanges/ExchangesPage';
import { LandingPage } from './components/home/LandingPage';
import { Filter, Grid, List } from 'lucide-react';
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
  const [view, setView] = useState<'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'public-profile' | 'admin'>(!user ? 'landing' : 'listings');
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'remote' | 'on_site' | 'both'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
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
          media:listing_media(*)
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleRequestAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!user && view === 'landing') {
    return (
      <div className="min-h-screen">
        <LandingPage
          onExplore={() => setView('listings')}
          onCreateAccount={() => setView('listings')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header
        onCreateListing={() => setShowCreateModal(true)}
        onSearch={handleSearch}
        onNavigate={setView}
        onRequestAuth={handleRequestAuth}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user && (
          <div className="mb-6 flex items-center space-x-3">
            <button
              onClick={() => setView('listings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                view === 'listings'
                  ? 'bg-brand-blue text-white shadow-soft-lg'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Annonces</span>
            </button>
            <button
              onClick={() => setView('proposals')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                view === 'proposals'
                  ? 'bg-brand-blue text-white shadow-soft-lg'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Mes propositions</span>
            </button>
          </div>
        )}

        {view === 'listings' ? (
          <>
            <div className="mb-6 bg-white rounded-3xl shadow-soft-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-heading font-semibold text-brand-text">Filtres</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-brand-blue hover:text-sky-600"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {showFilters && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterType === 'all'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setFilterType('service')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterType === 'service'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Services
                      </button>
                      <button
                        onClick={() => setFilterType('product')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterType === 'product'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Produits
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mode
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFilterMode('all')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterMode === 'all'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setFilterMode('remote')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterMode === 'remote'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        À distance
                      </button>
                      <button
                        onClick={() => setFilterMode('on_site')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterMode === 'on_site'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Sur place
                      </button>
                      <button
                        onClick={() => setFilterMode('both')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          filterMode === 'both'
                            ? 'bg-brand-blue text-white shadow-soft-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Les deux
                      </button>
                    </div>
                  </div>

                  {categories.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Catégories
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setFilterCategory(null)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            filterCategory === null
                              ? 'bg-brand-blue text-white shadow-soft-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Toutes
                        </button>
                        {categories.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => setFilterCategory(category.id)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              filterCategory === category.id
                                ? 'bg-brand-blue text-white shadow-soft-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Grid className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Aucune annonce trouvée
                </h3>
                <p className="text-gray-600 mb-6">
                  Soyez le premier à proposer un échange !
                </p>
                {user && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary px-6 py-3 rounded-full"
                  >
                    Créer une annonce
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={setSelectedListing}
                    onUserClick={handleUserClick}
                  />
                ))}
              </div>
            )}
          </>
        ) : view === 'proposals' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">Mes propositions</h2>
            <ProposalsList 
              onSelectProposal={setSelectedProposal}
              onUserClick={handleUserClick}
            />
          </div>
        ) : view === 'profile' ? (
          <ProfilePage 
            onUserClick={handleUserClick}
          />
        ) : view === 'settings' ? (
          <SettingsPage />
        ) : view === 'exchanges' ? (
          <ExchangesPage 
            onUserClick={handleUserClick}
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
      </div>

      <CreateListingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadListings}
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
        onClose={() => setSelectedProposal(null)}
        onUpdate={loadListings}
        onUserClick={(userId) => {
          setSelectedProposal(null);
          handleUserClick(userId);
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
