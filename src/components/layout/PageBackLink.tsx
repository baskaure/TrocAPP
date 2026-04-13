type PageBackLinkProps = {
  onClick: () => void;
  label: string;
  className?: string;
};

/**
 * Lien retour aligné sur toutes les pages (icône Material + libellé).
 */
export function PageBackLink({ onClick, label, className = '' }: PageBackLinkProps) {
  return (
    <div className={`mb-10 flex min-h-[28px] items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="group flex items-center text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:text-primary dark:text-slate-400"
      >
        <span className="material-symbols-outlined mr-1 text-[20px] leading-none">arrow_back</span>
        {label}
      </button>
    </div>
  );
}

/** Même marge verticale que {@link PageBackLink} pour aligner les titres quand il n’y a pas de retour. */
export function PageBackRowSpacer() {
  return <div className="mb-10 min-h-[28px]" aria-hidden="true" />;
}
