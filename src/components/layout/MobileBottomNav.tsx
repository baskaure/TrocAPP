type MobileBottomNavProps = {
  active: 'explore' | 'category' | 'chat' | 'person';
  onExplore: () => void;
  onCategory: () => void;
  onAdd: () => void;
  onChat: () => void;
  onPerson: () => void;
};

export function MobileBottomNav({ active, onExplore, onCategory, onAdd, onChat, onPerson }: MobileBottomNavProps) {
  const iconBtn = (isActive: boolean, icon: string, onClick: () => void, filled?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-slate-400'}`}
      aria-label={icon}
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
    <div className="glass-panel fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 items-center justify-between rounded-full px-6 py-4 shadow-2xl md:hidden">
      {iconBtn(active === 'explore', 'explore', onExplore, active === 'explore')}
      {iconBtn(active === 'category', 'category', onCategory)}
      <div className="relative -top-10">
        <button
          type="button"
          onClick={onAdd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40"
          aria-label="Proposer un échange"
        >
          <span className="material-symbols-outlined text-[28px] text-white">add</span>
        </button>
      </div>
      {iconBtn(active === 'chat', 'chat', onChat)}
      {iconBtn(active === 'person', 'person', onPerson)}
    </div>
  );
}
