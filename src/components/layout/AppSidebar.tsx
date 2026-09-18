export type AppSidebarActiveItem =
  | 'explore'
  | 'proposals'
  | 'exchanges'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'none';

type AppSidebarProps = {
  /** Faux : la barre reste dans le DOM mais est masquée (évite les sauts de mise en page). */
  visible?: boolean;
  activeItem: AppSidebarActiveItem;
  onAnnonces: () => void;
  onProposals: () => void;
  onExchanges: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onAdmin?: () => void;
  onSupport: () => void;
  onCreateListing: () => void;
  showAdmin?: boolean;
};

export function AppSidebar({
  visible = true,
  activeItem,
  onAnnonces,
  onProposals,
  onExchanges,
  onProfile,
  onSettings,
  onAdmin,
  onSupport,
  onCreateListing,
  showAdmin,
}: AppSidebarProps) {
  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-4 rounded-full px-4 py-3 text-left font-headline text-sm font-bold transition-all duration-300 ${
      active ? 'bg-primary/10 text-primary dark:bg-slate-800 dark:text-primary' : 'text-on-surface-variant/70 hover:bg-surface-container-high dark:hover:bg-slate-800/80'
    }`;

  const visibilityClass = visible
    ? 'lg:pointer-events-auto lg:translate-x-0 lg:opacity-100'
    : 'lg:pointer-events-none lg:-translate-x-full lg:opacity-0';

  return (
    <aside
      aria-label="Menu de l’espace membre"
      aria-hidden={!visible}
      className={`fixed left-0 top-0 z-40 mt-20 hidden h-[calc(100dvh-5rem)] w-64 flex-col rounded-r-xl bg-surface-container-low p-8 pb-6 shadow-[12px_0_32px_rgba(0,0,0,0.04)] transition-[transform,opacity] duration-200 ease-out will-change-transform dark:bg-slate-950 lg:flex ${visibilityClass}`}
    >
      <div className="mb-8">
        <p className="mb-1 font-headline text-xl font-extrabold text-primary">Mon espace</p>
        <p className="text-xs text-on-surface-variant/70 dark:text-slate-500">Navigation</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        <button type="button" className={itemClass(activeItem === 'explore')} onClick={onAnnonces}>
          <span className="material-symbols-outlined text-[22px]">explore</span>
          <span>Annonces</span>
        </button>
        <button type="button" className={itemClass(activeItem === 'proposals')} onClick={onProposals}>
          <span className="material-symbols-outlined text-[22px]">description</span>
          <span>Propositions</span>
        </button>
        <button type="button" className={itemClass(activeItem === 'exchanges')} onClick={onExchanges}>
          <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
          <span>Mes échanges</span>
        </button>
        <button type="button" className={itemClass(activeItem === 'profile')} onClick={onProfile}>
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span>Mon profil</span>
        </button>
        <button type="button" className={itemClass(activeItem === 'settings')} onClick={onSettings}>
          <span className="material-symbols-outlined text-[22px]">settings</span>
          <span>Paramètres</span>
        </button>
        {showAdmin && onAdmin ? (
          <button type="button" className={itemClass(activeItem === 'admin')} onClick={onAdmin}>
            <span className="material-symbols-outlined text-[22px]">shield</span>
            <span>Administration</span>
          </button>
        ) : null}

      </nav>

      <div className="mt-4 shrink-0 space-y-3 border-t border-outline-variant/15 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={onCreateListing}
          className="w-full rounded-full bg-primary py-3.5 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98]"
        >
          Proposer un échange
        </button>
        <button
          type="button"
          onClick={onSupport}
          className="w-full px-4 py-2.5 text-left font-headline text-sm font-bold text-on-surface-variant/70 transition-colors hover:text-primary dark:text-slate-500"
        >
          Aide &amp; support
        </button>
      </div>
    </aside>
  );
}
