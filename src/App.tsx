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
  const [view, setView] = useState<'landing' | 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges'>(!user ? 'landing' : 'listings');
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadCategories();
    loadListings();
  }, [filterType, searchQuery]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
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
    <div className="min-h-screen bg-gray-50">
      <Header
        onCreateListing={() => setShowCreateModal(true)}
        onSearch={handleSearch}
        onNavigate={setView}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user && (
          <div className="mb-6 flex items-center space-x-4">
            <button
              onClick={() => setView('listings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'listings'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Grid className="w-5 h-5" />
              <span>Annonces</span>
            </button>
            <button
              onClick={() => setView('proposals')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'proposals'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <List className="w-5 h-5" />
              <span>Mes propositions</span>
            </button>
          </div>
        )}

        {view === 'listings' ? (
          <>
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Filtres</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-blue-600 hover:text-blue-700"
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
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          filterType === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setFilterType('service')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          filterType === 'service'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Services
                      </button>
                      <button
                        onClick={() => setFilterType('product')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          filterType === 'product'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Produits
                      </button>
                    </div>
                  </div>

                  {categories.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Catégories
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {categories.slice(0, 6).map((category) => (
                          <button
                            key={category.id}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Créer une annonce
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={setSelectedListing}
                  />
                ))}
              </div>
            )}
          </>
        ) : view === 'proposals' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">Mes propositions</h2>
            <ProposalsList onSelectProposal={setSelectedProposal} />
          </div>
        ) : view === 'profile' ? (
          <ProfilePage />
        ) : view === 'settings' ? (
          <SettingsPage />
        ) : view === 'exchanges' ? (
          <ExchangesPage />
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
      />

      <ProposalDetailModal
        proposal={selectedProposal}
        onClose={() => setSelectedProposal(null)}
        onUpdate={loadListings}
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
