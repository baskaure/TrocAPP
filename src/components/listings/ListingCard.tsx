import { Listing } from '../../lib/supabase';

type ListingCardProps = {
  listing: Listing;
  onClick: (listing: Listing) => void;
};

function modeLabel(mode: Listing['mode']) {
  if (mode === 'remote') return 'À distance';
  if (mode === 'on_site') return 'Présentiel';
  return 'Les deux';
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const imageUrl = listing.media && listing.media.length > 0 ? listing.media[0].url : null;
  const city = listing.user?.city?.trim();
  const verified = listing.user?.is_verified === true;

  return (
    <button
      type="button"
      onClick={() => onClick(listing)}
      className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest text-left transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5"
    >
      <div className="relative h-64 overflow-hidden bg-surface-container">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary-container/30 font-headline text-sm font-bold text-primary">
            BonTroc
          </div>
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {city ? (
            <span className="rounded bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface shadow-sm backdrop-blur">
              {city}
            </span>
          ) : null}
          {verified ? (
            <span className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
              <span
                className="material-symbols-outlined text-[12px] leading-none text-white"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                verified
              </span>
              Certifié
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-grow flex-col p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
            {listing.type === 'service' ? 'Service' : 'Produit'}
          </span>
          <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
            {modeLabel(listing.mode)}
          </span>
        </div>

        <h3 className="mb-6 font-headline text-xl font-extrabold leading-tight text-on-surface line-clamp-2">
          {listing.title}
        </h3>

        <div className="mb-8 space-y-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-primary">J&apos;offre</p>
            <p className="line-clamp-2 text-sm text-on-surface-variant">{listing.description_offer}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-secondary">Je cherche</p>
            <p className="line-clamp-2 text-sm text-on-surface-variant">{listing.desired_exchange_desc}</p>
          </div>
        </div>

        <span className="mt-auto w-full rounded-xl border-2 border-primary/10 py-4 text-center font-headline text-base font-extrabold text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white">
          Voir l&apos;offre
        </span>
      </div>
    </button>
  );
}
