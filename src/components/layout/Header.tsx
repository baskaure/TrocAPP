import { memo, useState } from 'react';
import { User, LogOut, Settings, Package, Shield } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { APP_HEADER_HEIGHT_CLASS } from './app-layout';

export type AppNavView = 'listings' | 'proposals' | 'profile' | 'settings' | 'exchanges' | 'admin';

type HeaderProps = {
  onLogoClick: () => void;
  onCreateListing: () => void;
  onNavigate?: (view: AppNavView) => void;
  onRequestAuth?: (mode: 'login' | 'register') => void;
};

function HeaderInner({ onLogoClick, onCreateListing, onNavigate, onRequestAuth }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 ${APP_HEADER_HEIGHT_CLASS} bg-white/70 shadow-xl shadow-primary/5 backdrop-blur-xl [transform:translateZ(0)] backface-hidden`}
    >
      <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6 md:px-8">
        <div className="flex items-center">
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center rounded-lg outline-none ring-primary/30 transition-opacity hover:opacity-90 focus-visible:ring-2"
            aria-label="BonTroc — Accueil"
          >
            <img
              src="/logo/5.png"
              alt="BonTroc"
              className="h-9 w-auto max-h-[2.75rem] object-contain md:h-10"
            />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={onCreateListing}
            className="rounded-full bg-primary px-4 py-2 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all duration-200 hover:opacity-95 active:scale-95 md:px-6 md:py-2.5"
          >
            <span className="hidden sm:inline">Proposer un échange</span>
            <span className="sm:hidden">Proposer</span>
          </button>

          {user ? (
            <>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-surface-container-high dark:text-slate-400"
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined text-[22px] md:text-[24px]">notifications</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('settings')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-surface-container-high dark:text-slate-400"
                aria-label="Paramètres"
              >
                <span className="material-symbols-outlined text-[22px] md:text-[24px]">settings</span>
              </button>
            </>
          ) : null}

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-sm"
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary-container text-sm font-bold text-on-secondary-container">
                    {(user.display_name?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </button>

              {showUserMenu && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Fermer le menu"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-surface-container-high bg-surface-container-lowest py-2 shadow-xl">
                    <p className="truncate px-4 py-2 text-sm font-semibold text-on-surface">{user.display_name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.('exchanges');
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-low"
                    >
                      <Package className="h-4 w-4" />
                      Mes échanges
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.('profile');
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-low"
                    >
                      <User className="h-4 w-4" />
                      Mon profil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.('settings');
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-low"
                    >
                      <Settings className="h-4 w-4" />
                      Paramètres
                    </button>
                    {['admin', 'moderator'].includes(user.role) && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate?.('admin');
                          setShowUserMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-primary hover:bg-surface-container-low"
                      >
                        <Shield className="h-4 w-4" />
                        Administration
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-error hover:bg-error-container/30"
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRequestAuth?.('login')}
                className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => onRequestAuth?.('register')}
                className="inline-flex min-h-10 items-center rounded-full border border-primary/20 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
              >
                S&apos;inscrire
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export const Header = memo(HeaderInner);
