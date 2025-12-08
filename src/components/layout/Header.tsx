import { useState } from 'react';
import { Plus, User, LogOut, Settings, Search, Package, Shield } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

type HeaderProps = {
  onCreateListing: () => void;
  onSearch: (query: string) => void;
  onNavigate?: (view: 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin') => void;
  onRequestAuth?: (mode: 'login' | 'register') => void;
};

export function Header({ onCreateListing, onSearch, onNavigate, onRequestAuth }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery.trim());
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('listings')}
              className="flex items-center gap-2 shrink-0"
            >
              {/* Logo compact pour mobile, logo horizontal pour desktop */}
              <img
                src="/logo/5.png"
                alt="BonTroc"
                className="h-8 w-auto sm:hidden"
              />
              <img
                src="/logo/5.png"
                alt="BonTroc"
                className="hidden sm:block h-8 w-auto"
              />
            </button>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Bouton mobile - icône seulement */}
                  <button
                    onClick={onCreateListing}
                    className="sm:hidden flex items-center justify-center w-10 h-10 rounded-full bg-brand-blue text-white shadow-soft-lg hover:bg-sky-500 transition-colors"
                    aria-label="Proposer un échange"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {/* Bouton desktop - texte complet */}
                  <button
                    onClick={onCreateListing}
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue text-white text-sm font-semibold shadow-soft-lg hover:bg-sky-500 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Proposer un échange</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1.5 rounded-full transition-colors"
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-brand-yellow text-white rounded-full flex items-center justify-center">
                          {user.display_name[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium hidden sm:block">{user.display_name}</span>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-soft-lg border border-gray-100 py-2 z-20">
                        <button
                          onClick={() => {
                            onNavigate?.('exchanges');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left text-sm"
                        >
                          <Package className="w-4 h-4" />
                          <span>Mes échanges</span>
                        </button>
                        <button
                          onClick={() => {
                            onNavigate?.('profile');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left text-sm"
                        >
                          <User className="w-4 h-4" />
                          <span>Mon profil</span>
                        </button>
                        <button
                          onClick={() => {
                            onNavigate?.('settings');
                            setShowUserMenu(false);
                          }}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Paramètres</span>
                        </button>
                        {user && ['admin', 'moderator'].includes(user.role) && (
                          <button
                            onClick={() => {
                              onNavigate?.('admin');
                              setShowUserMenu(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left text-xs font-semibold text-purple-600"
                          >
                            <Shield className="w-4 h-4" />
                            <span>Administration</span>
                          </button>
                        )}
                        <button
                          onClick={signOut}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 w-full text-left text-xs font-semibold text-red-600"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Déconnexion</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRequestAuth?.('login')}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Connexion
                  </button>
                  <button
                    onClick={() => onRequestAuth?.('register')}
                    className="btn-primary px-4 py-2 rounded-full"
                  >
                    S'inscrire
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Barre de recherche mobile-first */}
          <form
            onSubmit={handleSearch}
            className={`pb-3 pt-1 md:pt-0 md:pb-4 transition-all ${showUserMenu ? 'mt-4' : 'mt-0'}`}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un service, un produit, une ville..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white transition-colors"
              />
            </div>
          </form>
        </div>
      </header>
    </>
  );
}
