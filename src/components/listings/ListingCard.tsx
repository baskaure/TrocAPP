import { Listing } from '../../lib/supabase';
import { MODE_LABEL } from '../../lib/labels';
import { listingPlaceholder } from './placeholders';

type ListingCardProps = {
  listing: Listing;
  onClick: (listing: Listing) => void;
};

/**
 * Carte d'annonce : un <article> avec un vrai lien sur le titre (le bouton « Voir l'offre »
 * étend la zone cliquable), pour que les lecteurs d'écran listent les annonces par titre.
 */
export function ListingCard({ listing, onClick }: ListingCardProps) {
  const imageUrl = listing.media && listing.media.length > 0 ? listing.media[0].url : null;
  const placeholder = listingPlaceholder(listing);
  const city = listing.user?.city?.trim();
  const verified = listing.user?.is_verified === true;
  const href = `/annonces/${listing.id}`;

  const open = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    onClick(listing);
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg transition-all duration-500 focus-within:ring-2 focus-within:ring-primary/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
      <div className="relative h-64 overflow-hidden bg-surface-container">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${placeholder.gradient}`} aria-hidden>
            <span className="material-symbols-outlined text-6xl text-primary/70">{placeholder.icon}</span>
          </div>
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {city ? (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface shadow-sm backdrop-blur">
              {city}
            </span>
          ) : null}
          {verified ? (
            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-primary shadow-sm">
              <span
                className="material-symbols-outlined text-[12px] leading-none text-on-primary"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                aria-hidden
              >
                verified
              </span>
              Vérifié
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-grow flex-col p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
            {listing.type === 'service' ? 'Service' : 'Produit'}
          </span>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
            {MODE_LABEL[listing.mode]}
          </span>
        </div>

        <h2 className="mb-6 font-headline text-xl font-extrabold leading-tight text-on-surface line-clamp-2">
          <a href={href} onClick={open} className="outline-none after:absolute after:inset-0 after:content-['']">
            {listing.title}
          </a>
        </h2>

        <div className="mb-8 space-y-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-primary">J&apos;offre</p>
            <p className="line-clamp-2 text-sm text-on-surface-variant">{listing.description_offer}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-secondary">Je cherche</p>
            <p className="line-clamp-2 text-sm text-on-surface-variant">{listing.desired_exchange_desc || 'Ouvert aux propositions'}</p>
          </div>
        </div>

        <span
          aria-hidden
          className="mt-auto w-full rounded-full border-2 border-primary/10 py-4 text-center font-headline text-base font-extrabold text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-on-primary"
        >
          Voir l&apos;offre
        </span>
      </div>
    </article>
  );
}
