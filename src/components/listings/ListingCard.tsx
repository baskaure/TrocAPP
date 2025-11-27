import { MapPin, Star, TrendingUp, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { Listing } from '../../lib/supabase';

type ListingCardProps = {
  listing: Listing;
  onClick: (listing: Listing) => void;
  onUserClick?: (userId: string) => void;
};

export function ListingCard({ listing, onClick, onUserClick }: ListingCardProps) {
  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : null;

  const getGradientForType = (type: string) => {
    return type === 'service'
      ? 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700'
      : 'bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-700';
  };

  return (
    <button
      onClick={() => onClick(listing)}
      className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-slate-200 text-left hover:-translate-y-1 w-full"
    >
      <div className={`${imageUrl ? '' : getGradientForType(listing.type)} h-56 relative overflow-hidden`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>

        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold text-slate-900 flex items-center gap-1.5 shadow-lg">
            <MapPin className="w-3.5 h-3.5" />
            {listing.user?.city || 'Non spécifié'}
          </div>
        </div>

        {listing.user?.is_verified && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 flex gap-2">
          <div className="bg-black/30 backdrop-blur-md rounded-lg px-3 py-1 text-xs font-medium text-white">
            {listing.type === 'service' ? 'Service' : 'Produit'}
          </div>
          <div className="bg-black/30 backdrop-blur-md rounded-lg px-3 py-1 text-xs font-medium text-white">
            {listing.mode === 'remote' ? 'Distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Les deux'}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
        <div
          onClick={(e) => {
            if (listing.user?.id && onUserClick) {
              e.stopPropagation();
              onUserClick(listing.user.id);
            }
          }}
          className={onUserClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        >
          {listing.user?.avatar_url ? (
            <img
              src={listing.user.avatar_url}
              alt={listing.user.display_name}
              className="w-11 h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {listing.user?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>

          <div className="flex-1 min-w-0">
            <div
              onClick={(e) => {
                if (listing.user?.id && onUserClick) {
                  e.stopPropagation();
                  onUserClick(listing.user.id);
                }
              }}
              className={`font-semibold text-slate-900 truncate ${onUserClick ? 'cursor-pointer hover:text-violet-600 transition-colors' : ''}`}
            >
              {listing.user?.display_name || 'Utilisateur'}
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-1">
              {listing.user && listing.user.rating_count > 0 ? (
                <>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-slate-900">{listing.user.rating_avg.toFixed(1)}</span>
                  <span className="text-slate-400">·</span>
                  <span>{listing.user.rating_count} avis</span>
                </>
              ) : (
                <span>Nouveau membre</span>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-4 leading-snug group-hover:text-violet-600 transition-colors line-clamp-2">
          {listing.title}
        </h3>

        <div className="space-y-3">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">J'offre</div>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed line-clamp-2">{listing.description_offer}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100/50">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Je cherche</div>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed line-clamp-2">{listing.desired_exchange_desc}</div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{listing.user?.city || 'Non spécifié'}</span>
          </div>
          <div className="flex items-center gap-2 text-violet-600 font-semibold group-hover:gap-3 transition-all">
            Voir l'offre
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
