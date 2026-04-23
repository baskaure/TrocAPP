type MobileBottomNavProps = {
  active: 'explore' | 'category' | 'chat' | 'person';
  onExplore: () => void;
  onCategory: () => void;
  onAdd: () => void;
  onChat: () => void;
  onPerson: () => void;
};

export function MobileBottomNav({ active, onExplore, onCategory, onAdd, onChat, onPerson }: MobileBottomNavProps) {
  const iconBtn = (isActive: boolean, icon: string, onClick: () => void, label: string, filled?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center rounded-full py-1 transition-colors ${
        isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
      }`}
      aria-label={label}
    >
      <span
        className="material-symbols-outlined text-[26px]"
        style={
          filled
            ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
            : undefined
        }
      >
        {icon}
      </span>
    </button>
  );

  return (
    <div className="glass-panel fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-sm -translate-x-1/2 items-center justify-between gap-1 rounded-full px-4 py-2 shadow-2xl md:hidden">
      {iconBtn(active === 'explore', 'explore', onExplore, 'Explorer les annonces', active === 'explore')}
      {iconBtn(active === 'category', 'category', onCategory, 'Filtres / Catégories')}
      <div className="relative -top-7 flex-shrink-0">
        <button
          type="button"
          onClick={onAdd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95"
          aria-label="Proposer un échange"
        >
          <span className="material-symbols-outlined text-[28px] text-white">add</span>
        </button>
      </div>
      {iconBtn(active === 'chat', 'chat', onChat, 'Mes conversations')}
      {iconBtn(active === 'person', 'person', onPerson, 'Mon profil')}
    </div>
  );
}
