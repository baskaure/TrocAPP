import { Search, Code, Palette, Target, Hammer, Heart, BookOpen, Camera, Briefcase, Sparkles, Zap, Star, TrendingUp, MapPin, ChevronRight, Users, Award, Shield } from 'lucide-react';

type LandingPageProps = {
  onExplore: () => void;
  onCreateAccount: () => void;
};

const categories = [
  { name: 'Développement', icon: Code, color: 'from-violet-600 to-indigo-600', count: 124 },
  { name: 'Design', icon: Palette, color: 'from-fuchsia-600 to-pink-600', count: 89 },
  { name: 'Coaching', icon: Target, color: 'from-amber-600 to-orange-600', count: 67 },
  { name: 'Bricolage', icon: Hammer, color: 'from-emerald-600 to-teal-600', count: 54 },
  { name: 'Bien-être', icon: Heart, color: 'from-rose-600 to-pink-600', count: 43 },
  { name: 'Éducation', icon: BookOpen, color: 'from-blue-600 to-cyan-600', count: 78 },
  { name: 'Photo/Vidéo', icon: Camera, color: 'from-purple-600 to-violet-600', count: 56 },
  { name: 'Business', icon: Briefcase, color: 'from-slate-700 to-slate-900', count: 92 },
];

export function LandingPage({ onExplore, onCreateAccount }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-black">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-fuchsia-900/20 to-purple-900/20"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-grid-slate"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 text-white/90 text-sm mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Marketplace moderne de troc</span>
            </div>

            <h1 className="text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
              Échangez vos talents<br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                sans intermédiaire
              </span>
            </h1>

            <p className="text-xl text-white/70 max-w-2xl mb-12 leading-relaxed">
              Valorisez vos compétences et trouvez exactement ce dont vous avez besoin.
              Une plateforme pensée pour des échanges directs, équitables et transparents.
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-2 flex items-center gap-2">
              <div className="flex items-center flex-1 gap-3 px-4">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un service, un produit..."
                  className="flex-1 text-base outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={onExplore}
                className="px-6 py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                Rechercher
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-8 mt-20 pt-12 border-t border-white/10">
              <div>
                <div className="text-4xl font-bold text-white mb-2">2,847</div>
                <div className="text-white/50 text-sm font-medium">Échanges réalisés</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">1,234</div>
                <div className="text-white/50 text-sm font-medium">Membres actifs</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-white">4.9</div>
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-white/50 text-sm font-medium">Note moyenne</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="bg-gradient-to-b from-slate-50 to-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-3">Explorez par catégorie</h2>
              <p className="text-lg text-slate-600">Découvrez les talents disponibles près de chez vous</p>
            </div>
            <button
              onClick={onExplore}
              className="text-violet-600 font-semibold flex items-center gap-2 hover:gap-3 transition-all group"
            >
              Toutes les catégories
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => {
              const IconComponent = cat.icon;
              return (
                <button
                  key={i}
                  onClick={onExplore}
                  className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 hover:border-slate-200"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-base font-semibold text-slate-900">{cat.name}</div>
                  <div className="text-sm text-slate-500 mt-1">{cat.count} offres</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Pourquoi choisir TrocHub ?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Une plateforme pensée pour faciliter vos échanges en toute sécurité
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-3xl p-8 border border-violet-100">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">100% Sécurisé</h3>
              <p className="text-slate-600 leading-relaxed">
                Tous les échanges sont contractualisés automatiquement avec double signature pour votre protection.
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Communauté vérifiée</h3>
              <p className="text-slate-600 leading-relaxed">
                Système d'avis et de notation pour échanger en toute confiance avec des membres de qualité.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-100">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Rapide & Simple</h3>
              <p className="text-slate-600 leading-relaxed">
                Trouvez ce que vous cherchez en quelques clics et négociez directement via notre chat intégré.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-b from-white to-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Comment ça marche ?</h2>
            <p className="text-lg text-slate-600">En 4 étapes simples</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Créez votre annonce', desc: 'Décrivez ce que vous offrez et ce que vous cherchez', icon: Target },
              { step: '2', title: 'Recevez des propositions', desc: 'Les membres intéressés vous contactent', icon: MapPin },
              { step: '3', title: 'Négociez & acceptez', desc: 'Discutez et validez l\'échange', icon: TrendingUp },
              { step: '4', title: 'Échangez & notez', desc: 'Réalisez l\'échange et laissez un avis', icon: Award },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="text-center">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full border-2 border-violet-600 flex items-center justify-center font-bold text-violet-600 text-sm">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-8">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-6">Prêt à échanger ?</h2>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            Rejoignez des milliers de personnes qui échangent leurs talents et services sans intermédiaire
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onCreateAccount}
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:shadow-2xl transition-all hover:scale-[1.02]"
            >
              Créer mon compte
            </button>
            <button
              onClick={onExplore}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all"
            >
              Explorer les offres
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
