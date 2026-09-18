import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { HeroGeometric } from '../ui/shape-landing-hero';
import type { LegalSection } from '../../lib/router';

type LandingPageProps = {
  onExplore: () => void;
  onCreateAccount: () => void;
  onLogin?: () => void;
  onLegal?: (section: LegalSection) => void;
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const NAV_LINKS = [
  { id: 'etapes', label: 'Comment ça marche' },
  { id: 'usages', label: 'Ce qu’on échange' },
  { id: 'fonctionnalites', label: 'Confiance' },
] as const;

const LEGAL_LINKS: { section: LegalSection; label: string }[] = [
  { section: 'mentions-legales', label: 'Mentions légales' },
  { section: 'confidentialite', label: 'Confidentialité' },
  { section: 'cgu', label: 'CGU' },
];

export function LandingPage({ onExplore, onCreateAccount, onLogin, onLegal }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = () => {
    if (onLogin) onLogin();
    else onExplore();
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleNavLink = (id: string) => {
    setMobileOpen(false);
    scrollToSection(id);
  };

  const legalLink = (section: LegalSection, label: string, className: string) => (
    <a
      key={section}
      href={`/${section}`}
      onClick={(e) => {
        if (!onLegal) return;
        e.preventDefault();
        onLegal(section);
      }}
      className={className}
    >
      {label}
    </a>
  );

  return (
    <div className="min-h-screen selection:bg-primary/20 bg-background text-on-surface font-inter">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav
          aria-label="Navigation"
          className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-300 sm:px-6 ${
            scrolled
              ? 'border border-outline-variant/20 bg-white/80 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl'
              : 'border border-transparent bg-white/55 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-md'
          }`}
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex shrink-0 items-center rounded-lg outline-none ring-primary/30 transition-opacity hover:opacity-90 focus-visible:ring-2"
            aria-label="BonTroc, accueil"
          >
            <img src="/logo/5.png" alt="BonTroc" width={462} height={102} className="h-9 w-auto object-contain sm:h-10" />
          </a>

          <div className="hidden items-center gap-1 md:flex">
            <a
              href="/annonces"
              onClick={(e) => {
                e.preventDefault();
                onExplore();
              }}
              className="rounded-full px-4 py-2 font-headline text-sm font-semibold tracking-tight text-primary transition-colors hover:bg-primary/5"
            >
              Les annonces
            </a>
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNavLink(link.id)}
                className="rounded-full px-4 py-2 font-headline text-sm font-semibold tracking-tight text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLogin}
              className="hidden min-h-10 rounded-full px-3 py-2 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5 active:scale-95 sm:inline-flex sm:px-4"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={onCreateAccount}
              className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 py-2 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25 active:scale-95 sm:px-6 sm:py-2.5"
            >
              Commencer
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 -z-10 cursor-default bg-on-surface/20 backdrop-blur-sm md:hidden"
              aria-label="Fermer le menu"
              onClick={() => setMobileOpen(false)}
            />
            <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-outline-variant/20 bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl md:hidden">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onExplore();
                }}
                className="flex min-h-11 w-full items-center rounded-2xl px-4 py-3 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Les annonces
              </button>
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavLink(link.id)}
                  className="flex min-h-11 w-full items-center rounded-2xl px-4 py-3 font-headline text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogin();
                }}
                className="mt-1 flex min-h-11 w-full items-center rounded-2xl border border-outline-variant/30 px-4 py-3 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Connexion
              </button>
            </div>
          </>
        )}
      </header>

      <main id="contenu">
        <HeroGeometric
          badge="Troc de services et d’objets"
          title1="Échangez sans argent,"
          title2="en toute confiance."
          description="Vous publiez ce que vous proposez et ce que vous cherchez. Quelqu’un vous fait une proposition, vous discutez, vous signez un contrat d’échange, vous laissez un avis. Gratuit, sans commission."
        >
          <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:gap-6">
            <button
              type="button"
              onClick={onCreateAccount}
              className="hero-gradient min-h-12 rounded-full px-8 py-4 text-base font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95 sm:px-10 sm:py-5 sm:text-lg"
            >
              Créer un compte gratuit
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="min-h-12 rounded-full bg-surface-container-lowest px-8 py-4 text-base font-bold text-primary shadow-sm transition-colors hover:bg-surface-container sm:px-10 sm:py-5 sm:text-lg"
            >
              Voir les annonces
            </button>
          </div>

          <div className="relative mt-14 w-full sm:mt-16 md:mt-20">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-secondary/20 blur-[120px]" aria-hidden />
            <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary/15 blur-[150px]" aria-hidden />
            <div className="glass-card relative z-10 mx-auto max-w-5xl rounded-2xl border border-white/40 p-3 shadow-2xl sm:p-4">
              <div className="overflow-hidden rounded-xl">
                <img
                  src="/logo/screen.webp"
                  alt="Illustration : des personnes échangent des services et des objets"
                  width={1024}
                  height={439}
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-[21/9] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </HeroGeometric>

        <section id="usages" className="bg-surface-container-low py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <div className="mb-16 flex flex-col items-end justify-between gap-8 md:mb-20 md:flex-row">
              <div className="max-w-xl">
                <h2 className="mb-6 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
                  Ce qu’on échange sur BonTroc
                </h2>
                <p className="text-lg text-on-surface-variant">
                  Un coup de main contre un objet, une compétence contre une autre, un meuble contre des cours. Vous fixez la
                  contrepartie, l’autre accepte ou propose autre chose.
                </p>
              </div>
              <button
                type="button"
                onClick={onExplore}
                className="min-h-12 rounded-full bg-secondary-container px-8 py-4 font-bold text-on-secondary-container transition-transform hover:scale-105"
              >
                Parcourir les annonces
              </button>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="group flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-all duration-500 hover:shadow-xl md:col-span-8 md:p-12">
                <div className="mb-10 md:mb-12">
                  <span className="material-symbols-outlined mb-6 block text-5xl text-primary" aria-hidden>
                    handshake
                  </span>
                  <h3 className="mb-4 font-headline text-2xl font-bold text-on-surface md:text-3xl">Des services</h3>
                  <p className="max-w-md text-lg text-on-surface-variant">
                    Cours de guitare, aide au déménagement, site web, traduction, jardinage. Vous proposez ce que vous savez
                    faire, sans toucher à votre trésorerie.
                  </p>
                </div>
                <div className="h-56 overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary-container/40 to-secondary-container/30 md:h-64">
                  <div className="flex h-full flex-wrap content-center justify-center gap-3 p-8" aria-hidden>
                    {['code', 'palette', 'school', 'handyman', 'translate', 'music_note', 'yard', 'photo_camera'].map((icon) => (
                      <span
                        key={icon}
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-primary shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[28px]">{icon}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl bg-primary p-8 text-white shadow-lg md:col-span-4 md:p-12">
                <div>
                  <span
                    className="material-symbols-outlined mb-6 block text-5xl text-secondary-container"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                    aria-hidden
                  >
                    inventory_2
                  </span>
                  <h3 className="mb-4 font-headline text-2xl font-bold md:text-3xl">Des objets</h3>
                  <p className="text-lg text-primary-fixed/80">
                    Matériel informatique, mobilier, vélo, vêtements, outils. Un bien qui dort chez vous vaut quelque chose pour
                    quelqu’un d’autre.
                  </p>
                </div>
                <div className="mt-10 border-t border-white/10 pt-10 md:mt-12 md:pt-12">
                  <p className="text-sm font-medium">Gratuit, sans commission sur les échanges.</p>
                </div>
              </div>

              <div className="flex items-center gap-6 rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-shadow hover:shadow-md md:col-span-6 md:gap-8 md:p-10">
                <div className="shrink-0 rounded-lg bg-secondary-container/10 p-5 md:p-6">
                  <span className="material-symbols-outlined text-4xl text-secondary" aria-hidden>
                    location_on
                  </span>
                </div>
                <div>
                  <h3 className="mb-2 font-headline text-xl font-bold text-on-surface">Près de chez vous ou à distance</h3>
                  <p className="text-on-surface-variant">
                    Chaque annonce indique la ville et le mode d’échange : en main propre, à distance, ou les deux.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-shadow hover:shadow-md md:col-span-6 md:gap-8 md:p-10">
                <div className="shrink-0 rounded-lg bg-primary/10 p-5 md:p-6">
                  <span className="material-symbols-outlined text-4xl text-primary" aria-hidden>
                    forum
                  </span>
                </div>
                <div>
                  <h3 className="mb-2 font-headline text-xl font-bold text-on-surface">Une messagerie intégrée</h3>
                  <p className="text-on-surface-variant">
                    Vous négociez directement dans l’application, sans donner votre numéro ni votre adresse e-mail.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="bg-background py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <div className="mb-16 text-center md:mb-24">
              <h2 className="mb-6 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
                De quoi échanger l’esprit tranquille
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-on-surface-variant">
                Trois garde-fous concrets, pas des promesses.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
              <div className="group">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                  <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white" aria-hidden>
                    verified_user
                  </span>
                </div>
                <h3 className="mb-4 font-headline text-2xl font-bold text-on-surface">Identité vérifiable</h3>
                <p className="leading-relaxed text-on-surface-variant">
                  Un membre peut envoyer une pièce d’identité à notre équipe. Après contrôle, un badge « vérifié » apparaît sur
                  son profil et ses annonces.
                </p>
              </div>

              <div className="group">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                  <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white" aria-hidden>
                    contract
                  </span>
                </div>
                <h3 className="mb-4 font-headline text-2xl font-bold text-on-surface">Un contrat d’échange écrit</h3>
                <p className="leading-relaxed text-on-surface-variant">
                  Quand une proposition est acceptée, BonTroc rédige un contrat qui reprend l’annonce et la contrepartie. Les deux
                  parties le signent avant de commencer.
                </p>
              </div>

              <div className="group">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                  <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white" aria-hidden>
                    reviews
                  </span>
                </div>
                <h3 className="mb-4 font-headline text-2xl font-bold text-on-surface">Des avis après chaque échange</h3>
                <p className="leading-relaxed text-on-surface-variant">
                  Une fois l’échange confirmé par les deux côtés, chacun note l’autre. Les avis restent visibles sur les profils.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="etapes" className="px-4 py-24 sm:px-6 md:px-8 md:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-10 md:p-24">
              <div className="absolute -right-20 -top-20 rounded-full bg-primary/5 p-24" aria-hidden />
              <h2 className="mb-12 text-center font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:mb-20 md:text-5xl">
                Comment ça marche ?
              </h2>
              <ol className="relative flex flex-col items-start justify-between gap-10 md:flex-row md:gap-12">
                {[
                  { n: '01', title: 'Publiez votre annonce', text: 'Décrivez ce que vous proposez et ce que vous aimeriez recevoir en échange. Une photo, et c’est en ligne.' },
                  { n: '02', title: 'Recevez des propositions', text: 'Les membres intéressés vous écrivent. Vous acceptez, refusez ou faites une contre-proposition.' },
                  { n: '03', title: 'Signez, échangez, évaluez', text: 'Le contrat est signé en un clic par chacun. Après l’échange, vous confirmez et laissez un avis.' },
                ].map((step, i) => (
                  <li key={step.n} className="relative z-10 flex flex-1 items-start gap-6 text-left md:flex-col md:gap-0">
                    <span className="font-headline text-5xl font-black text-primary/15 md:-mb-6 md:text-7xl" aria-hidden>
                      {step.n}
                    </span>
                    <div>
                      <h3 className="relative mb-3 font-headline text-2xl font-bold text-on-surface">
                        <span className="sr-only">Étape {i + 1} : </span>
                        {step.title}
                      </h3>
                      <p className="text-on-surface-variant">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="cta" className="px-4 py-24 sm:px-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative flex flex-col items-center overflow-hidden rounded-xl bg-primary shadow-2xl md:flex-row md:items-stretch">
              <div className="relative z-10 p-10 md:w-3/5 md:p-24">
                <h2 className="mb-6 font-headline text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:mb-8 md:text-5xl lg:text-6xl">
                  Prêt à troquer ?
                </h2>
                <p className="mb-10 max-w-lg text-lg text-primary-fixed/80 md:mb-12 md:text-xl">
                  Créer un compte prend une minute. Pas de carte bancaire, pas d’abonnement.
                </p>
                <div className="flex flex-col gap-6 sm:flex-row">
                  <button
                    type="button"
                    onClick={onCreateAccount}
                    className="min-h-12 rounded-full bg-secondary-container px-10 py-5 text-lg font-bold text-on-secondary-container transition-all hover:scale-105 active:scale-95"
                  >
                    Créer mon compte
                  </button>
                  <a
                    href="mailto:contact@bontroc.fr"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-10 py-5 text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                  >
                    Nous écrire
                  </a>
                </div>
              </div>
              <div className="relative h-72 w-full self-stretch md:h-auto md:min-h-[28rem] md:w-2/5">
                <img
                  src="/logo/cta.webp"
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/40 to-transparent" aria-hidden />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full bg-surface-container-low py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row md:px-8">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-headline text-xl font-bold text-on-surface">BonTroc</span>
            <p className="text-center text-sm tracking-wide text-on-surface-variant font-inter md:text-left">
              © {new Date().getFullYear()} BonTroc. L&apos;échange intelligent.
            </p>
          </div>
          <nav aria-label="Liens légaux" className="flex flex-wrap justify-center gap-6 md:gap-8">
            {LEGAL_LINKS.map((l) =>
              legalLink(l.section, l.label, 'inline-flex min-h-10 items-center text-sm tracking-wide text-on-surface-variant transition-colors hover:text-primary font-inter'),
            )}
            <a
              href="mailto:contact@bontroc.fr"
              className="inline-flex min-h-10 items-center text-sm tracking-wide text-on-surface-variant transition-colors hover:text-primary font-inter"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
