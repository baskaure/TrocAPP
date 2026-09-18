import type { LegalSection } from '../../lib/router';

type AppFooterProps = {
  onLegal?: (section: LegalSection) => void;
};

const LEGAL_LINKS: { section: LegalSection; label: string }[] = [
  { section: 'mentions-legales', label: 'Mentions légales' },
  { section: 'confidentialite', label: 'Confidentialité' },
  { section: 'cgu', label: 'CGU' },
];

export function AppFooter({ onLegal }: AppFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 w-full border-t border-outline-variant/15 bg-surface-container-low py-12">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-center gap-6 px-4 sm:px-6 md:px-8">
        <nav aria-label="Liens légaux" className="flex flex-wrap justify-center gap-x-6 gap-y-3 md:gap-x-8">
          {LEGAL_LINKS.map((l) => (
            <a
              key={l.section}
              href={`/${l.section}`}
              onClick={(e) => {
                if (!onLegal) return;
                e.preventDefault();
                onLegal(l.section);
              }}
              className="inline-flex min-h-10 items-center text-xs font-inter uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
          <a
            href="mailto:contact@bontroc.fr"
            className="inline-flex min-h-10 items-center text-xs font-inter uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
          >
            Contact
          </a>
        </nav>
        <p className="text-center text-xs font-inter uppercase tracking-widest text-on-surface-variant">
          © {year} BonTroc. L&apos;échange intelligent.
        </p>
      </div>
    </footer>
  );
}
