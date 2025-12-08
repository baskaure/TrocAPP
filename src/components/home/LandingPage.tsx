import {
  Sparkles,
  Zap,
  Star,
  ChevronRight,
  Users,
  Shield,
  FileText,
  MessageCircle,
  Bell,
  Smartphone,
  CheckCheck,
  Target,
} from 'lucide-react';

type LandingPageProps = {
  onExplore: () => void;
  onCreateAccount: () => void;
};

const useCases = [
  { title: 'Services pros', detail: 'Coaching, dev, design, marketing', metric: '1 200+ offres actives' },
  { title: 'Échanges matériels', detail: 'Outillage, équipement, matériel créatif', metric: '640+ trocs sécurisés' },
  { title: 'Solidarité locale', detail: 'Aide ponctuelle, garde, soutien scolaire', metric: 'Communauté vérifiée' },
  { title: 'Entre pros', detail: 'Barter B2B avec contrats et suivi', metric: 'Contrats PDF & signatures' },
];

const featureCards = [
  {
    title: 'Contrat & PDF',
    desc: 'Contrat prêt à télécharger et à partager.',
    icon: FileText,
    tone: 'from-white to-white',
  },
  {
    title: 'Chat en direct + notifications',
    desc: 'Messagerie intégrée, alertes e-mail et mobile-friendly.',
    icon: MessageCircle,
    tone: 'from-brand-yellow/20 to-amber-50',
  },
  {
    title: 'Propositions',
    desc: 'Négociez, acceptez, refusez, suivez chaque étape.',
    icon: CheckCheck,
    tone: 'from-white to-white',
  },
  {
    title: 'Suivi & avis',
    desc: 'Statut d’échange, avis vérifiés, profils publics.',
    icon: Star,
    tone: 'from-white to-white',
  },
  {
    title: 'Sécurité & modération',
    desc: 'Signalements, mots bannis, rôles admin/modo.',
    icon: Shield,
    tone: 'from-white to-white',
  },
  {
    title: 'Mobile-first',
    desc: 'UI réactive et accessible, modals responsives.',
    icon: Smartphone,
    tone: 'from-white to-white',
  },
];

export function LandingPage({ onExplore, onCreateAccount }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-bg via-white to-brand-bg" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(25,173,250,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-grid-slate opacity-30" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16">
          <div className="grid lg:grid-cols-[1.2fr,1fr] gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur rounded-full border border-brand-blue/20 text-xs font-medium text-brand-blue shadow-soft-lg animate-fade-up">
                <Sparkles className="w-4 h-4" />
                <span>Contrats, chat, avis, mobile-first</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold text-brand-text tracking-tight leading-tight animate-fade-up anim-delay-1">
                BonTroc
                <br />
                <span className="text-brand-blue">le troc pro et mobile</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed animate-fade-up anim-delay-2">
                Services, produits, barters : chat, contrat PDF, suivi et avis intégrés.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 animate-fade-up anim-delay-3">
                {[
                  { icon: Shield, label: 'Contrat & suivi' },
                  { icon: MessageCircle, label: 'Chat + notif e-mail' },
                  { icon: Users, label: 'Profils & avis' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-white rounded-2xl border border-gray-100 px-3 py-2 shadow-soft-lg">
                      <Icon className="w-4 h-4 text-brand-blue" />
                      {item.label}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up anim-delay-4">
                <button
                  onClick={onCreateAccount}
                  className="btn-primary rounded-full w-full sm:w-auto justify-center text-sm sm:text-base px-6 py-3"
                >
                  Créer mon compte
                </button>
                <button
                  onClick={onExplore}
                  className="btn-secondary rounded-full w-full sm:w-auto justify-center text-sm sm:text-base px-6 py-3"
                >
                  Parcourir les trocs
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>Notes & avis vérifiés</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-brand-blue" />
                  <span>Alertes e-mail & mobile</span>
                </div>
              </div>
            </div>

            {/* Card stats illustratives */}
            <div className="hidden lg:flex flex-col gap-4">
              <div className="bg-white rounded-3xl shadow-soft-lg p-5 border border-gray-100 space-y-3 animate-float-soft">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Confiance & activité
                  </span>
                  <Zap className="w-4 h-4 text-brand-yellow" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-2xl font-heading font-semibold text-brand-text">2 800+</div>
                    <div className="text-gray-500 text-xs mt-1">Échanges</div>
                  </div>
                  <div>
                    <div className="text-2xl font-heading font-semibold text-brand-text">1 200+</div>
                    <div className="text-gray-500 text-xs mt-1">Membres actifs</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-heading font-semibold text-brand-text">4,9</span>
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="text-gray-500 text-xs mt-1">Avis</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  Pros & particuliers • Contrat PDF • Chat • Suivi
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use cases Section */}
      <div className="bg-gradient-to-b from-brand-bg to-white py-16 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-brand-text mb-3">
                Pour tous vos échanges
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                Services, matériel, entraide ou barters B2B.
              </p>
            </div>
            <button
              onClick={onExplore}
              className="hidden sm:inline-flex text-brand-blue font-semibold text-sm flex items-center gap-2 hover:gap-3 transition-all group"
            >
              Découvrir
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {useCases.slice(0, 3).map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-soft-lg border border-gray-100 p-5 flex items-center justify-between hover:shadow-lg transition-shadow animate-fade-up"
              >
                <div>
                  <div className="text-lg font-semibold text-brand-text">{item.title}</div>
                  <p className="text-sm text-gray-600 mt-1">{item.detail}</p>
                </div>
                <div className="text-xs font-semibold text-brand-blue bg-brand-blue/10 px-3 py-1 rounded-full">
                  {item.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-brand-text mb-3">
              L’essentiel, prêt à l’emploi
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Contrat, chat, suivi, avis, modération : tout est inclus.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {featureCards.slice(0, 4).map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${card.tone} rounded-3xl p-6 border border-gray-100 shadow-soft-lg animate-fade-up`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/80 flex items-center justify-center mb-3 shadow-soft-lg">
                    <Icon className="w-5 h-5 text-brand-blue" />
                  </div>
                  <h3 className="text-base font-heading font-semibold text-brand-text mb-1.5">{card.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-b from-white to-brand-bg py-16 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-brand-text mb-3">En 3 étapes</h2>
            <p className="text-base sm:text-lg text-gray-600">Simple, clair, mobile-first.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { step: '1', title: 'Publiez', desc: 'Annonce claire, photos, sur place ou à distance.', icon: Target },
              { step: '2', title: 'Échangez', desc: 'Propositions, contre-propositions, chat en direct.', icon: MessageCircle },
              { step: '3', title: 'Validez', desc: 'Contrat PDF, suivi, avis vérifiés.', icon: FileText },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="text-center animate-fade-up">
                  <div className="relative mb-5">
                    <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full border-2 border-brand-blue flex items-center justify-center font-bold text-brand-blue text-sm">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-heading font-semibold text-brand-text mb-1">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-br from-brand-blue/12 via-white to-brand-yellow/12 py-18 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-blue flex items-center justify-center mx-auto mb-2 shadow-soft-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-brand-text">
            Lancez votre prochain échange avec BonTroc
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Contrat PDF, chat, suivi, avis, modération : tout est prêt pour un troc sérieux,
            mobile-first et aligné sur la charte BonTroc.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onCreateAccount}
              className="btn-primary rounded-full px-8 py-3 w-full sm:w-auto justify-center"
            >
              Créer mon compte
            </button>
            <button
              onClick={onExplore}
              className="btn-secondary rounded-full px-8 py-3 w-full sm:w-auto justify-center"
            >
              Explorer les offres
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-brand-blue" />
              Contrats & litiges gérés
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4 text-brand-blue" />
              Chat + e-mails
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
