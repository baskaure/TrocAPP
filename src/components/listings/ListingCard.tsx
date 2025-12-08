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
      ? 'bg-gradient-to-br from-brand-blue to-sky-500'
      : 'bg-gradient-to-br from-brand-yellow to-amber-400';
  };

  return (
    <button
      onClick={() => onClick(listing)}
      className="group bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-soft-lg hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-slate-200 text-left hover:-translate-y-1 w-full"
    >
      <div className={`${imageUrl ? '' : getGradientForType(listing.type)} h-32 sm:h-48 relative overflow-hidden`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>

        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-slate-900 flex items-center gap-1 sm:gap-1.5 shadow-lg">
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[60px] sm:max-w-none">{listing.user?.city || 'N/A'}</span>
          </div>
        </div>

        {listing.user?.is_verified && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/95 backdrop-blur-sm rounded-full p-1.5 sm:p-2 shadow-lg">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-brand-blue" />
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 flex gap-1 sm:gap-2">
          <div className="bg-black/30 backdrop-blur-md rounded-md sm:rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium text-white">
            {listing.type === 'service' ? 'Service' : 'Produit'}
          </div>
          <div className="bg-black/30 backdrop-blur-md rounded-md sm:rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium text-white truncate">
            {listing.mode === 'remote' ? 'Distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Les deux'}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
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
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-brand-yellow text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md">
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
              className={`font-semibold text-slate-900 truncate ${onUserClick ? 'cursor-pointer hover:text-brand-blue transition-colors' : ''}`}
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

        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4 leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">
          {listing.title}
        </h3>

        <div className="space-y-2 sm:space-y-3">
          <div className="bg-gradient-to-br from-brand-blue/5 to-sky-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-brand-blue/10">
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-blue" />
              <div className="text-[10px] sm:text-[11px] font-semibold text-brand-blue uppercase tracking-wide">J'offre</div>
            </div>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-2">{listing.description_offer}</div>
          </div>

          <div className="bg-gradient-to-br from-brand-yellow/10 to-amber-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-brand-yellow/30">
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-yellow" />
              <div className="text-[10px] sm:text-[11px] font-semibold text-brand-yellow uppercase tracking-wide">Je cherche</div>
            </div>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-2">{listing.desired_exchange_desc}</div>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="hidden sm:flex text-sm text-slate-500 items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{listing.user?.city || 'Non spécifié'}</span>
          </div>
          <div className="flex items-center gap-2 text-brand-blue font-semibold group-hover:gap-3 transition-all ml-auto sm:ml-0">
            Voir l'offre
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
