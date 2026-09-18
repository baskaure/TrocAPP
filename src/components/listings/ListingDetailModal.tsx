import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ReportFormPanel } from '../reports/ReportModal';
import { LocationMap } from '../maps/LocationMap';
import { Listing, supabase, errorMessage } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';
import { PageBackLink } from '../layout/PageBackLink';
import { geocodeCity } from '../../lib/geocode';
import { useNotice } from '../ui/Toast';
import { checkContent } from '../../lib/moderation';
import { IMAGE_ACCEPT, prepareImage, storagePathFromPublicUrl } from '../../lib/image';
import { LISTING_STATUS_LABEL, MODE_LABEL, formatDateFr } from '../../lib/labels';
import { listingPlaceholder } from './placeholders';

type ListingDetailModalProps = {
  listing: Listing | null;
  onClose: () => void;
  onProposalSuccess: () => void;
  onRequestAuth?: (mode: 'login' | 'register') => void;
  onUserClick?: (userId: string) => void;
};

const WANTED_ICONS = ['potted_plant', 'cleaning_services', 'support_agent', 'handyman', 'eco', 'build', 'directions_bike'] as const;

const viewedThisSession = new Set<string>();

function offerBulletPoints(description: string): string[] {
  const t = description.trim();
  if (!t) return [];
  const lines = t.split(/\n/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const paras = t.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  return paras.length ? paras : [t];
}

function wantedItems(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const lines = t.split(/\n/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const parts = t.split(/[;•]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  return [t];
}

const HERO_SHADOW = 'shadow-soft-lg';

export function ListingDetailModal({ listing, onClose, onProposalSuccess, onRequestAuth, onUserClick }: ListingDetailModalProps) {
  const { user } = useAuth();
  const { toast, confirm } = useNotice();
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalOffer, setProposalOffer] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [existingProposalId, setExistingProposalId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    type: listing?.type ?? 'service',
    title: listing?.title ?? '',
    description_offer: listing?.description_offer ?? '',
    desired_exchange_desc: listing?.desired_exchange_desc ?? '',
    mode: listing?.mode ?? 'both',
    estimation_min: listing?.estimation_min?.toString() ?? '',
    estimation_max: listing?.estimation_max?.toString() ?? '',
  });

  const listingId = listing?.id;
  const isOwnListing = Boolean(user && listing && user.id === listing.user_id);

  const hydrateEditForm = useCallback(() => {
    if (!listing) return;
    setEditForm({
      type: listing.type,
      title: listing.title,
      description_offer: listing.description_offer,
      desired_exchange_desc: listing.desired_exchange_desc ?? '',
      mode: listing.mode,
      estimation_min: listing.estimation_min != null ? String(listing.estimation_min) : '',
      estimation_max: listing.estimation_max != null ? String(listing.estimation_max) : '',
    });
  }, [listing]);

  useEffect(() => {
    hydrateEditForm();
    setEditMode(false);
    setEditError('');
    setShowProposalForm(false);
    setNewImageUrl(null);
    setGeocodedCoords(null);
  }, [listingId, hydrateEditForm]);

  // Compteur de vues (une fois par annonce et par session, jamais pour le propriétaire).
  useEffect(() => {
    if (!listingId || isOwnListing || viewedThisSession.has(listingId)) return;
    viewedThisSession.add(listingId);
    void supabase.rpc('increment_listing_views', { p_listing_id: listingId });
  }, [listingId, isOwnListing]);

  // Une proposition ouverte existe-t-elle déjà de ma part ?
  useEffect(() => {
    if (!user || !listingId || isOwnListing) {
      setExistingProposalId(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('proposals')
      .select('id')
      .eq('listing_id', listingId)
      .eq('from_user_id', user.id)
      .in('status', ['pending', 'countered'])
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setExistingProposalId(data && data.length > 0 ? data[0].id : null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, listingId, isOwnListing]);

  // Carte : coordonnées de l'annonce, sinon ville du membre (géocodée, en cache).
  const listingLat = listing?.location_lat;
  const listingLng = listing?.location_lng;
  const userCity = listing?.user?.city?.trim();
  const userCountry = listing?.user?.country ?? undefined;
  useEffect(() => {
    if (!listingId) return;
    const latN = listingLat != null ? Number(listingLat) : NaN;
    const lngN = listingLng != null ? Number(listingLng) : NaN;
    if ((Number.isFinite(latN) && Number.isFinite(lngN)) || !userCity) {
      setGeocodeLoading(false);
      return;
    }
    let cancelled = false;
    setGeocodeLoading(true);
    geocodeCity(userCity, userCountry).then((coords) => {
      if (cancelled) return;
      if (coords) setGeocodedCoords(coords);
      setGeocodeLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, listingLat, listingLng, userCity, userCountry]);

  /** Retire du stockage une photo téléversée qui ne sera finalement pas rattachée à l'annonce. */
  const discardPendingImage = useCallback((url: string | null) => {
    const path = storagePathFromPublicUrl(url, 'listing-media');
    if (path) void supabase.storage.from('listing-media').remove([path]);
  }, []);

  if (!listing) return null;

  const categoryName = listing.category?.name;
  const placeholder = listingPlaceholder(listing);
  const imageUrl = listing.media && listing.media.length > 0 ? listing.media[0].url : null;

  const preciseLat = listing.location_lat != null ? Number(listing.location_lat) : NaN;
  const preciseLng = listing.location_lng != null ? Number(listing.location_lng) : NaN;
  const hasPreciseCoords = Number.isFinite(preciseLat) && Number.isFinite(preciseLng);
  const mapLat = hasPreciseCoords ? preciseLat : geocodedCoords?.lat;
  const mapLng = hasPreciseCoords ? preciseLng : geocodedCoords?.lng;
  const showMap = mapLat != null && mapLng != null && Number.isFinite(mapLat) && Number.isFinite(mapLng);
  const mapIsApproximate = showMap && !hasPreciseCoords;

  const locationLabel = userCity || 'Non précisée';
  const mapCaption = userCity ? `${userCity}${listing.user?.country ? ` — ${listing.user.country}` : ''}` : 'Localisation indicative';
  const mapPopupLabel = mapIsApproximate ? `${mapCaption} — position approximative (ville)` : mapCaption;

  const bullets = offerBulletPoints(listing.description_offer);
  const wanted = wantedItems(listing.desired_exchange_desc ?? '');
  const ownerName = listing.user?.display_name ?? 'Membre';
  const ownerDeleted = listing.user?.status === 'deleted';
  const isPublished = listing.status === 'published';

  const handleSubmitProposal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProposalError('');
    const offer = proposalOffer.trim();
    const message = proposalMessage.trim();
    if (offer.length < 5) return setProposalError('Décrivez votre contrepartie (5 caractères minimum).');
    setProposalLoading(true);
    try {
      const moderation = await checkContent(`${offer}\n${message}`, user.id);
      if (moderation.hasBlock) {
        setProposalError(`Votre proposition contient un terme interdit (${moderation.blockWords.join(', ')}).`);
        return;
      }
      const { data, error: insertError } = await supabase
        .from('proposals')
        .insert({
          listing_id: listing.id,
          from_user_id: user.id,
          to_user_id: listing.user_id,
          message,
          offer_payload: { description: offer },
          status: 'pending',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      setProposalMessage('');
      setProposalOffer('');
      setShowProposalForm(false);
      setExistingProposalId(data.id);
      void sendTransactionalEmail('new_proposal', listing.user_id, {
        listing_title: listing.title,
        proposer_name: user.display_name,
        proposal_id: data.id,
      });
      toast.success('Proposition envoyée. Vous serez prévenu de la réponse.');
      onProposalSuccess();
    } catch (err: unknown) {
      setProposalError(errorMessage(err, 'Impossible d’envoyer la proposition'));
    } finally {
      setProposalLoading(false);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (!next) hydrateEditForm();
      return next;
    });
    setEditError('');
    discardPendingImage(newImageUrl);
    setNewImageUrl(null);
  };

  const handleCancelEdit = () => {
    discardPendingImage(newImageUrl);
    hydrateEditForm();
    setEditMode(false);
    setEditError('');
    setNewImageUrl(null);
  };

  const handleUploadImage = async (file?: File | null) => {
    if (!file || !user) return;
    setUploadingImage(true);
    setEditError('');
    try {
      const prepared = await prepareImage(file);
      const path = `images/${user.id}-${Date.now()}.${prepared.ext}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-media')
        .upload(path, prepared.blob, { contentType: prepared.contentType, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('listing-media').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Impossible de récupérer l'URL de l'image");
      discardPendingImage(newImageUrl);
      setNewImageUrl(data.publicUrl);
    } catch (err: unknown) {
      setEditError(errorMessage(err, "Échec du téléversement de l'image"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateListing = async (e: FormEvent) => {
    e.preventDefault();
    if (!isOwnListing || !user) return;
    setEditError('');
    const title = editForm.title.trim();
    const offer = editForm.description_offer.trim();
    const wantedText = editForm.desired_exchange_desc.trim();
    const min = editForm.estimation_min ? parseFloat(editForm.estimation_min) : null;
    const max = editForm.estimation_max ? parseFloat(editForm.estimation_max) : null;
    if (title.length < 3) return setEditError('Le titre doit contenir au moins 3 caractères.');
    if (min !== null && max !== null && min > max) return setEditError('La valeur minimale doit être inférieure à la valeur maximale.');
    setEditLoading(true);
    try {
      const moderation = await checkContent([title, offer, wantedText].join('\n'), user.id);
      if (moderation.hasBlock) {
        setEditError(`Le texte contient un terme interdit (${moderation.blockWords.join(', ')}).`);
        return;
      }
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          type: editForm.type,
          title,
          description_offer: offer,
          desired_exchange_desc: wantedText,
          mode: editForm.mode,
          estimation_min: min,
          estimation_max: max,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id)
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      if (newImageUrl) {
        const currentMedia = listing.media && listing.media.length > 0 ? listing.media[0] : null;
        if (currentMedia?.id) {
          const { error: mediaUpdateError } = await supabase
            .from('listing_media')
            .update({ url: newImageUrl })
            .eq('id', currentMedia.id)
            .eq('listing_id', listing.id);
          if (mediaUpdateError) throw mediaUpdateError;
          const oldPath = storagePathFromPublicUrl(currentMedia.url, 'listing-media');
          if (oldPath) void supabase.storage.from('listing-media').remove([oldPath]);
        } else {
          const { error: mediaInsertError } = await supabase
            .from('listing_media')
            .insert({ listing_id: listing.id, url: newImageUrl, type: 'image', sort_order: 0 });
          if (mediaInsertError) throw mediaInsertError;
        }
      }
      setEditMode(false);
      setNewImageUrl(null);
      toast.success('Annonce mise à jour.');
      await onProposalSuccess();
    } catch (err: unknown) {
      setEditError(errorMessage(err, 'Impossible de mettre à jour l’annonce'));
    } finally {
      setEditLoading(false);
    }
  };

  const handleArchiveListing = async () => {
    if (!isOwnListing || !user) return;
    const ok = await confirm({
      title: 'Retirer cette annonce ?',
      description: 'Elle ne sera plus visible sur le marché. Les échanges déjà engagés ne sont pas affectés.',
      confirmLabel: 'Retirer l’annonce',
      danger: true,
    });
    if (!ok) return;
    setEditError('');
    setArchiveLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('listings')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', listing.id)
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      toast.success('Annonce retirée.');
      await onProposalSuccess();
      onClose();
    } catch (err: unknown) {
      setEditError(errorMessage(err, 'Impossible de retirer l’annonce'));
    } finally {
      setArchiveLoading(false);
    }
  };

  const typeLabel = listing.type === 'service' ? 'Service' : 'Objet';
  const inputClass = 'w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-on-surface';

  return (
    <div className="relative w-full max-w-7xl bg-background text-on-surface">
      <div className="pb-28 pt-0 md:pb-24">
        <PageBackLink onClick={onClose} label="Retour aux annonces" />

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              {categoryName ?? 'Annonce'} · {typeLabel} · {MODE_LABEL[listing.mode]}
            </p>
            <h1 className="font-headline text-2xl font-black leading-[1.1] tracking-tight text-on-surface sm:text-3xl md:text-4xl">{listing.title}</h1>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2.5 rounded-full border border-outline-variant/15 bg-surface-container-lowest px-5 py-2.5 text-xs font-bold text-on-surface-variant shadow-sm">
            <span className="material-symbols-outlined text-sm text-primary" aria-hidden>
              calendar_today
            </span>
            Publiée le {formatDateFr(listing.created_at)}
          </div>
        </div>

        {!isPublished ? (
          <div role="status" className="mb-8 rounded-2xl border border-secondary-container bg-secondary-container/30 p-4 text-sm text-on-secondary-container">
            Cette annonce est {LISTING_STATUS_LABEL[listing.status].toLowerCase()} : elle n’apparaît plus sur le marché.
          </div>
        ) : null}

        <div className="mb-12 grid grid-cols-1 gap-10 lg:mb-16 lg:grid-cols-12">
          <div className="group lg:col-span-8">
            <div className={`relative aspect-[16/9] overflow-hidden rounded-3xl bg-surface-container-lowest ${HERO_SHADOW}`}>
              {imageUrl ? (
                <img
                  src={newImageUrl || imageUrl}
                  alt={`Photo de l’annonce ${listing.title}`}
                  width={1200}
                  height={675}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${placeholder.gradient}`} aria-hidden>
                  <span className="material-symbols-outlined text-8xl text-primary/70">{placeholder.icon}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" aria-hidden />
              <div className="absolute bottom-6 left-6 flex flex-wrap gap-2 sm:bottom-8 sm:left-8 sm:gap-3">
                <span className="rounded-full border border-white/40 bg-white/80 px-4 py-2 font-headline text-[10px] font-black uppercase tracking-[0.15em] text-primary backdrop-blur-xl">
                  {typeLabel}
                </span>
                <span className="rounded-full border border-white/40 bg-white/80 px-4 py-2 font-headline text-[10px] font-black uppercase tracking-[0.15em] text-primary backdrop-blur-xl">
                  {MODE_LABEL[listing.mode]}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg md:p-10">
              <div>
                {listing.user ? (
                  <button
                    type="button"
                    className={`mb-8 flex w-full items-center gap-5 text-left ${
                      onUserClick && !ownerDeleted ? 'cursor-pointer rounded-2xl transition-colors hover:bg-surface-container-low' : ''
                    }`}
                    onClick={() => onUserClick?.(listing.user!.id)}
                    disabled={!onUserClick || ownerDeleted}
                  >
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary font-headline text-2xl font-black text-on-primary shadow-lg shadow-primary/20">
                      {listing.user.avatar_url ? (
                        <img src={listing.user.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                      ) : (
                        ownerName[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div>
                      <p className="font-headline text-xl font-black tracking-tight text-on-surface">{ownerName}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {listing.user.is_verified ? (
                          <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
                            verified
                          </span>
                        ) : null}
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {listing.user.is_verified ? 'Membre vérifié' : 'Membre'}
                        </span>
                      </div>
                      {listing.user.rating_count > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                          {Number(listing.user.rating_avg).toFixed(1)} · {listing.user.rating_count} avis
                        </p>
                      ) : null}
                    </div>
                  </button>
                ) : null}

                <div className="mb-8 flex items-center gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <span className="material-symbols-outlined text-primary" aria-hidden>
                      location_on
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Localisation</p>
                    <span className="font-bold text-on-surface">{locationLabel}</span>
                  </div>
                </div>

                {isOwnListing && !showProposalForm ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={handleToggleEditMode}
                      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-primary py-5 font-headline text-sm font-black uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden>
                        edit_note
                      </span>
                      {editMode ? 'Fermer l’édition' : 'Modifier l’annonce'}
                    </button>
                    {isPublished ? (
                      <button
                        type="button"
                        onClick={handleArchiveListing}
                        disabled={archiveLoading}
                        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-outline-variant/15 bg-surface-container-lowest py-5 font-headline text-sm font-black uppercase tracking-widest text-error transition-all hover:bg-error-container/20 active:scale-[0.98] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden>
                          archive
                        </span>
                        {archiveLoading ? 'Retrait…' : 'Retirer l’annonce'}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!isOwnListing && user && !showProposalForm ? (
                  <div className="space-y-4">
                    {existingProposalId ? (
                      <div className="rounded-2xl border border-primary/20 bg-primary-fixed/30 p-4 text-sm text-on-primary-fixed">
                        Vous avez déjà une proposition en cours sur cette annonce. Retrouvez-la dans « Mes propositions ».
                      </div>
                    ) : ownerDeleted || !isPublished ? (
                      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Cette annonce n’accepte plus de proposition.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowProposalForm(true)}
                        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-primary py-5 font-headline text-sm font-black uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden>
                          handshake
                        </span>
                        Proposer un échange
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowReportModal((v) => !v)}
                      className="min-h-10 w-full py-2 text-center text-sm font-semibold text-on-surface-variant transition-colors hover:text-error"
                    >
                      Signaler cette annonce
                    </button>
                  </div>
                ) : null}

                {!user ? (
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4 text-center">
                    <p className="mb-3 text-sm text-on-surface-variant">Connectez-vous pour proposer un échange</p>
                    <button
                      type="button"
                      onClick={() => onRequestAuth?.('login')}
                      className="min-h-11 w-full rounded-full bg-primary py-3 font-headline text-sm font-bold text-on-primary"
                    >
                      Se connecter
                    </button>
                  </div>
                ) : null}

                {!isOwnListing && user && showProposalForm ? (
                  <form onSubmit={handleSubmitProposal} className="space-y-4">
                    <h2 className="font-headline font-bold text-on-surface">Votre proposition</h2>
                    <div>
                      <label htmlFor="proposal-offer" className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                        Ce que vous proposez en échange
                      </label>
                      <textarea
                        id="proposal-offer"
                        value={proposalOffer}
                        onChange={(e) => setProposalOffer(e.target.value)}
                        rows={4}
                        required
                        minLength={5}
                        maxLength={2000}
                        className="w-full resize-none rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Décrivez votre contrepartie…"
                      />
                    </div>
                    <div>
                      <label htmlFor="proposal-message" className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                        Message
                      </label>
                      <textarea
                        id="proposal-message"
                        value={proposalMessage}
                        onChange={(e) => setProposalMessage(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="w-full resize-none rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Un mot pour vous présenter (facultatif)…"
                      />
                    </div>
                    {proposalError ? (
                      <p role="alert" className="text-sm text-error">
                        {proposalError}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2">
                      <button type="submit" disabled={proposalLoading} className="min-h-11 rounded-full bg-primary py-3 font-headline text-sm font-bold text-on-primary disabled:opacity-50">
                        {proposalLoading ? 'Envoi…' : 'Envoyer la proposition'}
                      </button>
                      <button type="button" onClick={() => setShowProposalForm(false)} className="min-h-11 rounded-full bg-surface-container-high py-3 font-headline text-sm font-bold">
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {isOwnListing && editMode ? (
          <form onSubmit={handleUpdateListing} className="mb-12 space-y-4 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg md:p-8">
            <h2 className="font-headline text-lg font-black">Modifier l’annonce</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-type" className="mb-1 block text-sm font-medium">
                  Type
                </label>
                <select id="edit-type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'service' | 'product' })} className={inputClass}>
                  <option value="service">Service</option>
                  <option value="product">Objet</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-mode" className="mb-1 block text-sm font-medium">
                  Mode
                </label>
                <select id="edit-mode" value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value as 'remote' | 'on_site' | 'both' })} className={inputClass}>
                  <option value="both">Présentiel & à distance</option>
                  <option value="on_site">Présentiel</option>
                  <option value="remote">À distance</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="edit-title" className="mb-1 block text-sm font-medium">
                Titre
              </label>
              <input id="edit-title" type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required minLength={3} maxLength={120} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-offer" className="mb-1 block text-sm font-medium">
                  Offre
                </label>
                <textarea id="edit-offer" value={editForm.description_offer} onChange={(e) => setEditForm({ ...editForm, description_offer: e.target.value })} rows={4} required maxLength={3000} className={inputClass} />
              </div>
              <div>
                <label htmlFor="edit-wanted" className="mb-1 block text-sm font-medium">
                  Recherche
                </label>
                <textarea id="edit-wanted" value={editForm.desired_exchange_desc} onChange={(e) => setEditForm({ ...editForm, desired_exchange_desc: e.target.value })} rows={4} maxLength={3000} className={inputClass} />
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 p-4">
              <p className="mb-2 text-sm font-medium">Photo</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-28 overflow-hidden rounded-xl bg-surface-container">
                  {newImageUrl || imageUrl ? <img src={newImageUrl || imageUrl || ''} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <label className="btn-secondary min-h-11 cursor-pointer">
                  {uploadingImage ? 'Téléversement…' : 'Changer la photo'}
                  <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => handleUploadImage(e.target.files?.[0] ?? null)} disabled={uploadingImage} />
                </label>
                {newImageUrl ? (
                  <button
                    type="button"
                    className="min-h-10 text-xs text-error"
                    onClick={() => {
                      discardPendingImage(newImageUrl);
                      setNewImageUrl(null);
                    }}
                  >
                    Annuler la nouvelle photo
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-min" className="sr-only">
                  Valeur minimale
                </label>
                <input id="edit-min" type="number" min="0" step="0.01" placeholder="Min (€)" value={editForm.estimation_min} onChange={(e) => setEditForm({ ...editForm, estimation_min: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="edit-max" className="sr-only">
                  Valeur maximale
                </label>
                <input id="edit-max" type="number" min="0" step="0.01" placeholder="Max (€)" value={editForm.estimation_max} onChange={(e) => setEditForm({ ...editForm, estimation_max: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleCancelEdit} className="min-h-11 rounded-full bg-surface-container-high px-6 py-2 font-bold">
                Annuler
              </button>
              <button type="submit" disabled={editLoading || uploadingImage} className="min-h-11 rounded-full bg-primary px-6 py-2 font-bold text-on-primary disabled:opacity-50">
                {editLoading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : null}

        {editError ? (
          <div role="alert" className="mb-8 rounded-xl border border-error-container bg-error-container/15 p-3 text-sm text-on-error-container">
            {editError}
          </div>
        ) : null}

        {!editMode && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <section aria-labelledby="offer-title" className="rounded-3xl border border-outline-variant/15 border-l-[6px] border-l-primary bg-surface-container-lowest p-8 shadow-soft-lg md:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl bg-primary/10 p-3">
                  <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>
                    handshake
                  </span>
                </div>
                <h2 id="offer-title" className="font-headline text-2xl font-black tracking-tight text-on-surface">
                  Ce qui est proposé
                </h2>
              </div>
              <div className="space-y-6">
                {bullets.map((point, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="mt-1 rounded-full bg-primary/10 p-1">
                      <span className="material-symbols-outlined text-lg font-bold text-primary" aria-hidden>
                        check
                      </span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed text-on-surface-variant">{point}</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="wanted-title" className="rounded-3xl border border-outline-variant/15 border-l-[6px] border-l-secondary-container bg-surface-container-lowest p-8 shadow-soft-lg md:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl bg-secondary-container/20 p-3">
                  <span className="material-symbols-outlined text-2xl text-on-secondary-container" aria-hidden>
                    search_check
                  </span>
                </div>
                <h2 id="wanted-title" className="font-headline text-2xl font-black tracking-tight text-on-surface">
                  Ce qui est recherché
                </h2>
              </div>
              {wanted.length === 0 ? (
                <p className="text-on-surface-variant">Ouvert aux propositions : décrivez ce que vous pouvez offrir en échange.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-4">
                  {wanted.map((item, i) => (
                    <li key={i} className="group flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 transition-all hover:shadow-lg">
                      <div className="flex items-center gap-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container/10 transition-colors group-hover:bg-secondary-container/25">
                          <span className="material-symbols-outlined text-on-secondary-container" aria-hidden>
                            {WANTED_ICONS[i % WANTED_ICONS.length]}
                          </span>
                        </div>
                        <span className="font-headline text-lg font-black text-on-surface">{item}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {!editMode && (
          <section className="mt-16 md:mt-20" aria-labelledby="map-title">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <h2 id="map-title" className="flex items-center gap-3 font-headline text-xl font-black text-on-surface">
                <span className="material-symbols-outlined text-primary" aria-hidden>
                  map
                </span>
                Localisation
              </h2>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {mapCaption}
                {mapIsApproximate ? <span className="mt-1 block font-inter text-[10px] font-semibold normal-case text-primary">Carte centrée sur la ville</span> : null}
              </p>
            </div>
            <div className={`relative h-[280px] w-full overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest md:h-[400px] ${HERO_SHADOW}`}>
              {geocodeLoading && !showMap ? (
                <div className="flex h-full flex-col items-center justify-center bg-surface-container">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="mt-3 text-sm font-medium text-on-surface-variant">Chargement de la carte…</p>
                </div>
              ) : showMap ? (
                <LocationMap key={`${listing.id}-${mapLat}-${mapLng}`} lat={mapLat} lng={mapLng} zoom={mapIsApproximate ? 12 : 14} popupLabel={mapPopupLabel} className="z-[1] h-full min-h-[260px] w-full rounded-3xl" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-surface-container px-6 text-center">
                  <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant" aria-hidden>
                    map
                  </span>
                  <p className="text-sm font-semibold text-on-surface-variant">
                    {userCity ? `Zone : ${userCity} (carte indisponible)` : 'Le membre n’a pas indiqué de ville.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {showReportModal ? (
          <div className="mt-12 max-w-xl">
            <ReportFormPanel targetType="listing" targetId={listing.id} targetUserId={listing.user_id} onDismiss={() => setShowReportModal(false)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
