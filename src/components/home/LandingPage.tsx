type LandingPageProps = {
  onExplore: () => void;
  onCreateAccount: () => void;
  /** Connexion (ex. ouvrir la modale login) */
  onLogin?: () => void;
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const heroImg = '/logo/screen.png';
const serviceImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBMlDT-sETkF7gBCse0MOESC24YFcgEdEm_cdYuyh-xMmPJmxXi_FLen4YpAxsp12-_P9g5TH7WLI-uwLxw7zdaYz73eIUlPlDJtYcoaXlnQ_vGPd5UH0X5FzZoOCMvDbWjxH3xuGOP5FKQh9JnbU8vNu1cJFswsN8iF6ksCSjD95vrnOUa68GFcxrl0G_QgQ2UrAl-A67UpXQZvEAIG-mm8aWxqNu86nHib8KOP5iY9fyqxtrz3tJacL2LVJl5OZ2FR_D99LrnI6eJ';
const ctaImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDN4SQflEanNFHR4ouk2-5nfjjnYM_wa04bn0W8ECLv26AqQm0QXPNS0ovTGQG0xXvDlkFdqh3dcdTdct8_5Nb9EptkQHkjN58EDuaplXNaJnryjD7JTu-yPL13CRINVtHgQ-UqMGUD6T-2s2jtwOlIZ7ehmPMp0FAL3NP59OOKvT-JKq3mNovc3-Z7zddTRxSQ86s7zo92H012u_aAcYaMdI3IpOINW-DPWH7EspIWEipbmOyXvjir_H2H2ShZKUFVjInRnIo31Auk';

export function LandingPage({ onExplore, onCreateAccount, onLogin }: LandingPageProps) {
  const handleLogin = () => {
    if (onLogin) onLogin();
    else onExplore();
  };

  return (
    <div className="min-h-screen selection:bg-primary/20 bg-background text-on-surface font-inter">
      {/* TopNavBar */}
      <nav className="fixed top-0 z-50 w-full bg-white/70 shadow-[0_20px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:bg-slate-900/70">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 md:px-8">
          <div className="font-manrope text-2xl font-black tracking-tighter text-primary dark:text-primary">
            BonTroc
          </div>
          <div className="hidden items-center gap-10 md:flex">
            <button
              type="button"
              onClick={onExplore}
              className="border-b-2 border-primary pb-1 font-manrope font-semibold tracking-tight text-primary transition-all duration-300 hover:opacity-80 dark:text-primary"
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('etapes')}
              className="font-manrope font-semibold tracking-tight text-slate-600 transition-all duration-300 hover:text-primary hover:opacity-80 dark:text-slate-400"
            >
              Comment ça marche
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('usages')}
              className="font-manrope font-semibold tracking-tight text-slate-600 transition-all duration-300 hover:text-primary hover:opacity-80 dark:text-slate-400"
            >
              Cas d&apos;usage
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('fonctionnalites')}
              className="font-manrope font-semibold tracking-tight text-slate-600 transition-all duration-300 hover:text-primary hover:opacity-80 dark:text-slate-400"
            >
              Fonctionnalités
            </button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleLogin}
              className="px-3 py-2 font-manrope font-semibold text-primary transition-all hover:opacity-80 active:scale-90 dark:text-primary sm:px-4"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={onCreateAccount}
              className="rounded-full bg-primary px-4 py-2.5 font-manrope font-bold text-on-primary transition-all hover:opacity-80 active:scale-95 sm:px-6 sm:py-3"
            >
              Commencer
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="overflow-hidden px-6 pb-24 pt-40 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
          <span className="mb-8 rounded-full bg-primary-fixed px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            L&apos;économie circulaire, version pro
          </span>
          <h1 className="mb-8 max-w-4xl text-5xl font-extrabold leading-tight tracking-tighter text-on-surface md:text-7xl lg:text-8xl font-manrope">
            BonTroc — le troc <span className="italic text-primary">pro</span> et{' '}
            <span className="text-primary">mobile</span>
          </h1>
          <p className="mb-12 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
            Transformez vos actifs dormants en ressources stratégiques. Échangez des services, des équipements et du
            temps entre professionnels en toute sécurité.
          </p>
          <div className="mb-20 flex flex-col gap-6 sm:flex-row">
            <button
              type="button"
              onClick={onCreateAccount}
              className="hero-gradient rounded-full px-10 py-5 text-lg font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Rejoindre le réseau
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="rounded-full bg-surface-container-lowest px-10 py-5 text-lg font-bold text-primary shadow-sm transition-colors hover:bg-surface-container"
            >
              Explorer le marché
            </button>
          </div>

          <div className="relative w-full px-4">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-secondary/30 blur-[120px]" />
            <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary/20 blur-[150px]" />
            <div className="glass-card relative z-10 mx-auto max-w-5xl rounded-xl border border-white/40 p-4 shadow-2xl">
              <div className="overflow-hidden rounded-lg">
                <img
                  src={heroImg}
                  alt="Espace de travail professionnel, écrans et visualisations de données"
                  className="aspect-[21/9] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section (Bento Grid) */}
      <section id="usages" className="bg-surface-container-low py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 flex flex-col items-end justify-between gap-8 md:mb-20 md:flex-row">
            <div className="max-w-xl">
              <h2 className="mb-6 text-4xl font-extrabold tracking-tighter text-on-surface md:text-5xl font-manrope">
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
                <h3 className="mb-4 text-2xl font-bold text-on-surface md:text-3xl font-manrope">
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
                <h3 className="mb-4 text-2xl font-bold md:text-3xl font-manrope">Équipement pro</h3>
                <p className="text-lg text-primary-fixed/80">
                  Renouvelez votre parc informatique ou mobilier de bureau via le troc direct.
                </p>
              </div>
              <div className="mt-10 border-t border-white/10 pt-10 md:mt-12 md:pt-12">
                <div className="flex -space-x-4">
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-slate-300" />
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-slate-400" />
                  <div className="h-12 w-12 rounded-full border-4 border-primary bg-slate-500" />
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
                <h3 className="mb-2 text-xl font-bold text-on-surface font-manrope">Troc de proximité</h3>
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
                <h3 className="mb-2 text-xl font-bold text-on-surface font-manrope">Banque de temps</h3>
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
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center md:mb-24">
            <h2 className="mb-6 text-4xl font-extrabold tracking-tighter text-on-surface md:text-5xl font-manrope">
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
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-manrope">Profils vérifiés</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Chaque membre passe un processus de vérification rigoureux pour garantir des échanges de haute qualité.
              </p>
            </div>

            <div className="group">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white">contract</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-manrope">Smart contracts</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Vos accords sont formalisés par des contrats numériques intelligents qui protègent les deux parties.
              </p>
            </div>

            <div className="group">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-high transition-colors group-hover:bg-primary">
                <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white">monitoring</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface font-manrope">Évaluation équitable</h3>
              <p className="leading-relaxed text-on-surface-variant">
                Un algorithme propriétaire aide à estimer la juste valeur des échanges pour garantir l&apos;équité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Process */}
      <section id="etapes" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-10 md:p-24">
            <div className="absolute -right-20 -top-20 rounded-full bg-primary/5 p-24" />
            <h2 className="mb-12 text-center text-3xl font-extrabold tracking-tighter text-on-surface md:mb-20 md:text-4xl font-manrope">
              Comment ça marche ?
            </h2>
            <div className="relative flex flex-col items-start justify-between gap-10 md:flex-row md:gap-12">
              <div className="relative z-10 flex-1 text-center md:text-left">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-7xl font-black text-primary/10 md:left-0 md:translate-x-0">
                  01
                </div>
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-manrope">
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
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-manrope">
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
                <h4 className="relative mb-4 text-2xl font-bold text-on-surface font-manrope">
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
      <section id="cta" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="relative flex flex-col items-center overflow-hidden rounded-xl bg-primary shadow-2xl md:flex-row">
            <div className="relative z-10 p-10 md:w-3/5 md:p-24">
              <h2 className="mb-6 text-4xl font-black leading-tight tracking-tighter text-white md:mb-8 md:text-5xl lg:text-6xl font-manrope">
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
            <div className="relative h-72 w-full md:h-auto md:min-h-[28rem] md:w-2/5">
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
      <footer className="w-full bg-slate-50 py-12 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-8 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-manrope text-xl font-bold text-slate-900 dark:text-slate-100">BonTroc</span>
            <p className="text-center text-sm tracking-wide text-slate-500 dark:text-slate-400 font-inter md:text-left">
              © {new Date().getFullYear()} BonTroc. Built for the modern architect.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            <span className="text-sm tracking-wide text-slate-500 dark:text-slate-400 font-inter">Confidentialité</span>
            <span className="text-sm tracking-wide text-slate-500 dark:text-slate-400 font-inter">CGU</span>
            <a
              href="mailto:contact@bontroc.fr"
              className="text-sm tracking-wide text-slate-500 transition-colors hover:text-primary dark:text-slate-400 font-inter"
            >
              Contact
            </a>
          </div>
          <div className="flex gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-slate-600">
              <span className="material-symbols-outlined text-sm">share</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-slate-600">
              <span className="material-symbols-outlined text-sm">public</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
