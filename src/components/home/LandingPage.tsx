import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { HeroGeometric } from '../ui/shape-landing-hero';

type LandingPageProps = {
  onExplore: () => void;
  onCreateAccount: () => void;
  /** Connexion (ex. ouvrir la modale login) */
  onLogin?: () => void;
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const NAV_LINKS = [
  { id: 'etapes', label: 'Comment ça marche' },
  { id: 'usages', label: "Cas d'usage" },
  { id: 'fonctionnalites', label: 'Fonctionnalités' },
] as const;

const heroImg = '/logo/screen.png';
const serviceImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBMlDT-sETkF7gBCse0MOESC24YFcgEdEm_cdYuyh-xMmPJmxXi_FLen4YpAxsp12-_P9g5TH7WLI-uwLxw7zdaYz73eIUlPlDJtYcoaXlnQ_vGPd5UH0X5FzZoOCMvDbWjxH3xuGOP5FKQh9JnbU8vNu1cJFswsN8iF6ksCSjD95vrnOUa68GFcxrl0G_QgQ2UrAl-A67UpXQZvEAIG-mm8aWxqNu86nHib8KOP5iY9fyqxtrz3tJacL2LVJl5OZ2FR_D99LrnI6eJ';
const ctaImg = '/logo/cta.png';

export function LandingPage({ onExplore, onCreateAccount, onLogin }: LandingPageProps) {
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

  return (
    <div className="min-h-screen selection:bg-primary/20 bg-background text-on-surface font-inter">
      {/* TopNavBar — pill flottante, scroll-aware */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-300 sm:px-6 ${
            scrolled
              ? 'border border-outline-variant/20 bg-white/80 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl'
              : 'border border-transparent bg-white/55 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-md'
          }`}
        >
          <button
            type="button"
            onClick={onExplore}
            className="flex shrink-0 items-center rounded-lg outline-none ring-primary/30 transition-opacity hover:opacity-90 focus-visible:ring-2"
            aria-label="BonTroc — Accueil"
          >
            <img src="/logo/5.png" alt="BonTroc" className="h-9 w-auto object-contain sm:h-10" />
          </button>

          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={onExplore}
              className="group relative rounded-full px-4 py-2 font-headline text-sm font-semibold tracking-tight text-primary transition-colors hover:bg-primary/5"
            >
              Place de marché
            </button>
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
              className="hidden rounded-full px-3 py-2 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5 active:scale-95 sm:inline-flex sm:px-4"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={onCreateAccount}
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 font-headline text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25 active:scale-95 sm:px-6 sm:py-2.5"
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
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Menu mobile */}
        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 -z-10 cursor-default bg-slate-900/20 backdrop-blur-sm md:hidden"
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
                className="flex w-full items-center rounded-2xl px-4 py-3 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Place de marché
              </button>
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavLink(link.id)}
                  className="flex w-full items-center rounded-2xl px-4 py-3 font-headline text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
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
                className="mt-1 flex w-full items-center rounded-2xl border border-outline-variant/30 px-4 py-3 font-headline text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Connexion
              </button>
            </div>
          </>
        )}
      </header>

      {/* Hero Section — fond animé (formes flottantes) */}
      <HeroGeometric
        badge="L'économie circulaire, version pro"
        title1="BonTroc — le troc"
        title2="pro et mobile"
        description="Transformez vos actifs dormants en ressources stratégiques. Échangez des services, des équipements et du temps entre professionnels en toute sécurité."
      >
        <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <button
            type="button"
            onClick={onCreateAccount}
            className="hero-gradient rounded-full px-8 py-4 text-base font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95 sm:px-10 sm:py-5 sm:text-lg"
          >
            Rejoindre le réseau
          </button>
          <button
            type="button"
            onClick={onExplore}
            className="rounded-full bg-surface-container-lowest px-8 py-4 text-base font-bold text-primary shadow-sm transition-colors hover:bg-surface-container sm:px-10 sm:py-5 sm:text-lg"
          >
            Explorer le marché
          </button>
        </div>

        <div className="relative mt-14 w-full sm:mt-16 md:mt-20">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-secondary/20 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary/15 blur-[150px]" />
          <div className="glass-card relative z-10 mx-auto max-w-5xl rounded-2xl border border-white/40 p-3 shadow-2xl sm:p-4">
            <div className="overflow-hidden rounded-xl">
              <img
                src={heroImg}
                alt="Espace de travail professionnel, écrans et visualisations de données"
                className="aspect-[21/9] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </HeroGeometric>

      {/* Use Cases Section (Bento Grid) */}
      <section id="usages" className="bg-surface-container-low py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mb-16 flex flex-col items-end justify-between gap-8 md:mb-20 md:flex-row">
            <div className="max-w-xl">
              <h2 className="mb-6 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
                Un écosystème pour chaque besoin
              </h2>
              <p className="text-lg text-on-surface-variant">
                Le troc moderne n&apos;est plus limité aux objets. Échangez ce que vous avez contre ce dont vous avez
                besoin.
              </p>
            </div>
            <button
              type="button"
              onClick={onExplore}
              className="rounded-full bg-secondary-container px-8 py-4 font-bold text-on-secondary-container transition-transform hover:scale-105"
            >
              Voir tous les usages
            </button>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            <div className="group flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-all duration-500 hover:shadow-xl md:col-span-8 md:p-12">
              <div className="mb-10 md:mb-12">
                <span className="material-symbols-outlined mb-6 block text-5xl text-primary">handshake</span>
                <h3 className="mb-4 text-2xl font-bold text-on-surface md:text-3xl font-headline">
                  Échange de services
                </h3>
                <p className="max-w-md text-lg text-on-surface-variant">
                  Développeurs, graphistes, comptables. Échangez vos compétences sans toucher à votre trésorerie.
                </p>
              </div>
              <div className="h-56 overflow-hidden rounded-lg bg-surface md:h-64">
                <img
                  src={serviceImg}
                  alt="Équipe de professionnels en collaboration"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-primary p-8 text-white shadow-lg md:col-span-4 md:p-12">
              <div>
                <span
                  className="material-symbols-outlined mb-6 block text-5xl text-secondary-container"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  inventory_2
                </span>
                <h3 className="mb-4 text-2xl font-bold md:text-3xl font-headline">Équipement pro</h3>
                <p className="text-lg text-primary-fixed/80">
                  Renouvelez votre parc informatique ou mobilier de bureau via le troc direct.
                </p>
              </div>
              <div className="mt-10 border-t border-white/10 pt-10 md:mt-12 md:pt-12">
                <div className="flex -space-x-4">
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-surface-container-high" />
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-outline-variant" />
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-on-surface-variant/40" />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary bg-secondary-container text-xs font-bold text-on-secondary-container">
                    +12k
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium">Rejoignez 12&nbsp;000+ entreprises</p>
              </div>
            </div>

            <div className="flex items-center gap-6 rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-shadow hover:shadow-md md:col-span-6 md:gap-8 md:p-10">
              <div className="shrink-0 rounded-lg bg-secondary-container/10 p-5 md:p-6">
                <span className="material-symbols-outlined text-4xl text-secondary">location_on</span>
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-on-surface font-headline">Troc de proximité</h3>
                <p className="text-on-surface-variant">
                  Favorisez les échanges locaux avec les entreprises de votre quartier.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 rounded-xl bg-surface-container-lowest p-8 shadow-sm transition-shadow hover:shadow-md md:col-span-6 md:gap-8 md:p-10">
              <div className="shrink-0 rounded-lg bg-primary/10 p-5 md:p-6">
                <span className="material-symbols-outlined text-4xl text-primary">schedule</span>
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-on-surface font-headline">Banque de temps</h3>
                <p className="text-on-surface-variant">
                  Monétisez vos heures creuses en les transformant en crédits BonTroc.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="bg-background py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mb-16 text-center md:mb-24">
            <h2 className="mb-6 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
              La technologie au service de la confiance
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-on-surface-variant">
              Une plateforme sécurisée, fluide et intuitive, conçue pour les professionnels exigeants.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
            <div className="group">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white">
                  verified_user
                </span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-headline">Profils vérifiés</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Chaque membre passe un processus de vérification rigoureux pour garantir des échanges de haute qualité.
              </p>
            </div>

            <div className="group">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white">contract</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-headline">Contrats intelligents</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Vos accords sont formalisés par des contrats numériques intelligents qui protègent les deux parties.
              </p>
            </div>

            <div className="group">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white">monitoring</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-headline">Évaluation équitable</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Un algorithme propriétaire aide à estimer la juste valeur des échanges pour garantir l&apos;équité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Process */}
      <section id="etapes" className="px-4 py-24 sm:px-6 md:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-10 md:p-24">
            <div className="absolute -right-20 -top-20 rounded-full bg-primary/5 p-24" />
            <h2 className="mb-12 text-center font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:mb-20 md:text-5xl">
              Comment ça marche ?
            </h2>
            <div className="relative flex flex-col items-start justify-between gap-10 md:flex-row md:gap-12">
              <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-7xl font-black text-primary/10 md:left-0 md:translate-x-0">
                  01
                </div>
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-headline">
                  Postez votre offre
                </h4>
                <p className="text-on-surface-variant">
                  Décrivez ce que vous proposez et ce que vous recherchez en échange.
                </p>
              </div>
              <div className="hidden pt-4 md:block">
                <span className="material-symbols-outlined text-outline-variant">east</span>
              </div>

              <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-7xl font-black text-primary/10 md:left-0 md:translate-x-0">
                  02
                </div>
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-headline">
                  Matchez &amp; négociez
                </h4>
                <p className="text-on-surface-variant">
                  Notre IA vous suggère les partenaires idéaux. Discutez en direct sur le chat.
                </p>
              </div>
              <div className="hidden pt-4 md:block">
                <span className="material-symbols-outlined text-outline-variant">east</span>
              </div>

              <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-7xl font-black text-primary/10 md:left-0 md:translate-x-0">
                  03
                </div>
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-headline">
                  Échangez &amp; évaluez
                </h4>
                <p className="text-on-surface-variant">
                  Réalisez le troc en toute confiance et laissez une évaluation pour la communauté.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="cta" className="px-4 py-24 sm:px-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative flex flex-col items-center overflow-hidden rounded-xl bg-primary shadow-2xl md:flex-row md:items-stretch">
            <div className="relative z-10 p-10 md:w-3/5 md:p-24">
              <h2 className="mb-6 font-headline text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:mb-8 md:text-5xl lg:text-6xl">
                Prêt à réinventer votre business ?
              </h2>
              <p className="mb-10 max-w-lg text-lg text-primary-fixed/80 md:mb-12 md:text-xl">
                Rejoignez le premier réseau de troc B2B mobile. L&apos;inscription est gratuite et prend moins de 2
                minutes.
              </p>
              <div className="flex flex-col gap-6 sm:flex-row">
                <button
                  type="button"
                  onClick={onCreateAccount}
                  className="rounded-full bg-secondary-container px-10 py-5 text-lg font-bold text-on-secondary-container transition-all hover:scale-105 active:scale-95"
                >
                  Démarrer maintenant
                </button>
                <a
                  href="mailto:contact@bontroc.fr"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-10 py-5 text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  Parler à un expert
                </a>
              </div>
            </div>
            <div className="relative h-72 w-full self-stretch md:h-auto md:min-h-[28rem] md:w-2/5">
              <img
                src={ctaImg}
                alt="Espace professionnel lumineux"
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low py-12 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row md:px-8">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-headline text-xl font-bold text-on-surface dark:text-slate-100">BonTroc</span>
            <p className="text-center text-sm tracking-wide text-on-surface-variant dark:text-slate-400 font-inter md:text-left">
              © {new Date().getFullYear()} BonTroc. L&apos;échange intelligent.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            <span className="text-sm tracking-wide text-on-surface-variant dark:text-slate-400 font-inter">Confidentialité</span>
            <span className="text-sm tracking-wide text-on-surface-variant dark:text-slate-400 font-inter">CGU</span>
            <a
              href="mailto:contact@bontroc.fr"
              className="text-sm tracking-wide text-on-surface-variant transition-colors hover:text-primary dark:text-slate-400 font-inter"
            >
              Contact
            </a>
          </div>
          <div className="flex gap-4">
            <a
              href="#"
              aria-label="Partager BonTroc"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-sm">share</span>
            </a>
            <a
              href="#"
              aria-label="Site web BonTroc"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-sm">public</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
