import { useState } from 'react';
import { Plus, User, LogOut, Settings, Search, Package } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { AuthModal } from '../auth/AuthModal';

type HeaderProps = {
  onCreateListing: () => void;
  onSearch: (query: string) => void;
  onNavigate?: (view: 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges') => void;
};

export function Header({ onCreateListing, onSearch, onNavigate }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">TrocMarket</h1>

              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un échange..."
                    className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </form>
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={onCreateListing}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Proposer un échange</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
                          {user.display_name[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium hidden sm:block">{user.display_name}</span>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                        <button
                          onClick={() => {
                            onNavigate?.('exchanges');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                        >
                          <Package className="w-4 h-4" />
                          <span>Mes échanges</span>
                        </button>
                        <button
                          onClick={() => {
                            onNavigate?.('profile');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                        >
                          <User className="w-4 h-4" />
                          <span>Mon profil</span>
                        </button>
                        <button
                          onClick={() => {
                            onNavigate?.('settings');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Paramètres</span>
                        </button>
                        <button
                          onClick={signOut}
                          className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-red-600"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Déconnexion</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleAuth('login')}
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Connexion
                  </button>
                  <button
                    onClick={() => handleAuth('register')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    S'inscrire
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
}
