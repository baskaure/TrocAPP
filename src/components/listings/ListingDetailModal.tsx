import { useEffect, useState, type FormEvent } from 'react';
import { ReportModal } from '../reports/ReportModal';
import { Listing, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';

type ListingWithCategory = Listing & {
  category?: { name: string } | null;
};

type ListingDetailModalProps = {
  listing: Listing | null;
  onClose: () => void;
  onProposalSuccess: () => void;
  onRequestAuth?: (mode: 'login' | 'register') => void;
  onUserClick?: (userId: string) => void;
};

const WANTED_ICONS = [
  'potted_plant',
  'cleaning_services',
  'support_agent',
  'handyman',
  'eco',
  'build',
  'directions_bike',
] as const;

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

const HERO_SHADOW = '[box-shadow:0_40px_100px_-20px_rgba(0,0,0,0.15)]';

export function ListingDetailModal({
  listing,
  onClose,
  onProposalSuccess,
  onRequestAuth,
  onUserClick,
}: ListingDetailModalProps) {
  const { user } = useAuth();
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalOffer, setProposalOffer] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editForm, setEditForm] = useState({
    type: listing?.type ?? 'service',
    title: listing?.title ?? '',
    description_offer: listing?.description_offer ?? '',
    desired_exchange_desc: listing?.desired_exchange_desc ?? '',
    mode: listing?.mode ?? 'both',
    estimation_min: listing?.estimation_min?.toString() ?? '',
    estimation_max: listing?.estimation_max?.toString() ?? '',
  });

  const hydrateEditForm = () => {
    if (!listing) return;
    setEditForm({
      type: listing.type,
      title: listing.title,
      description_offer: listing.description_offer,
      desired_exchange_desc: listing.desired_exchange_desc,
      mode: listing.mode,
      estimation_min: listing.estimation_min != null ? listing.estimation_min.toString() : '',
      estimation_max: listing.estimation_max != null ? listing.estimation_max.toString() : '',
    });
  };

  useEffect(() => {
    hydrateEditForm();
    setEditMode(false);
    setEditError('');
    setShowDeleteConfirm(false);
    setShowProposalForm(false);
  }, [listing]);

  if (!listing) return null;

  const lc = listing as ListingWithCategory;
  const categoryName = lc.category?.name;

  const imageUrl =
    listing.media && listing.media.length > 0
      ? listing.media[0].url
      : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=1200';

  const lat = listing.location_lat ?? listing.user?.geo_lat;
  const lng = listing.location_lng ?? listing.user?.geo_lng;
  const staticMapUrl =
    lat != null && lng != null
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=1200x400&maptype=mapnik`
      : null;

  const locationLabel = listing.user?.city?.trim() || 'Non précisée';
  const mapCaption = listing.user?.city
    ? `${listing.user.city}${listing.user?.country ? ` — ${listing.user.country}` : ''}`
    : 'Localisation indicative';

  const bullets = offerBulletPoints(listing.description_offer);
  const wanted = wantedItems(listing.desired_exchange_desc);

  const handleSubmitProposal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProposalError('');
    setProposalLoading(true);
    try {
      const { data, error: insertError } = await supabase
        .from('proposals')
        .insert({
          listing_id: listing.id,
          from_user_id: user.id,
          to_user_id: listing.user_id,
          message: proposalMessage,
          offer_payload: { description: proposalOffer },
          status: 'pending',
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setProposalMessage('');
      setProposalOffer('');
      setShowProposalForm(false);
      if (listing.user?.email) {
        sendTransactionalEmail('new_proposal', listing.user.email, {
          listing_title: listing.title,
          proposer_name: user.display_name,
          proposal_id: data.id,
        });
      }
      onProposalSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : "Une erreur est survenue lors de la création de la proposition";
      setProposalError(msg);
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
    setNewImageUrl(null);
  };

  const handleCancelEdit = () => {
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
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${listing.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-media')
        .upload(`images/${fileName}`, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('listing-media').getPublicUrl(`images/${fileName}`);
      if (!data?.publicUrl) throw new Error("Impossible de récupérer l'URL publique");
      setNewImageUrl(data.publicUrl);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : "Échec du téléversement de l'image";
      setEditError(msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateListing = async (e: FormEvent) => {
    e.preventDefault();
    if (!isOwnListing) return;
    setEditError('');
    setEditLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          type: editForm.type,
          title: editForm.title,
          description_offer: editForm.description_offer,
          desired_exchange_desc: editForm.desired_exchange_desc,
          mode: editForm.mode,
          estimation_min: editForm.estimation_min ? parseFloat(editForm.estimation_min) : null,
          estimation_max: editForm.estimation_max ? parseFloat(editForm.estimation_max) : null,
        })
        .eq('id', listing.id)
        .eq('user_id', user!.id);
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
        } else {
          const { error: mediaInsertError } = await supabase.from('listing_media').insert({
            listing_id: listing.id,
            url: newImageUrl,
            type: 'image',
            sort_order: 0,
          });
          if (mediaInsertError) throw mediaInsertError;
        }
      }
      setEditMode(false);
      setNewImageUrl(null);
      await onProposalSuccess();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Impossible de mettre à jour l’annonce';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!isOwnListing) return;
    setEditError('');
    setDeleteLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id)
        .eq('user_id', user!.id);
      if (deleteError) throw deleteError;
      await onProposalSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Impossible de supprimer l’annonce';
      setEditError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const isOwnListing = user?.id === listing.user_id;

  const modeLabel =
    listing.mode === 'remote'
      ? 'À distance'
      : listing.mode === 'on_site'
        ? 'Présentiel'
        : 'Présentiel & à distance';

  const typeLabel = listing.type === 'service' ? 'Service' : 'Produit';

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="relative min-h-screen w-full max-w-7xl bg-slate-50 text-on-surface dark:bg-slate-950 sm:my-4 sm:max-h-[95vh] sm:min-h-0 sm:overflow-y-auto sm:rounded-3xl sm:shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="fixed right-4 top-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-500 shadow-lg transition-all hover:bg-white hover:text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          aria-label="Fermer"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="px-4 pb-28 pt-20 md:px-8 md:pb-24 md:pt-24">
          {/* Fil d'Ariane + date */}
          <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-center">
            <nav className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <button type="button" onClick={onClose} className="hover:text-primary">
                Annonces
              </button>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              {categoryName ? (
                <>
                  <span className="text-on-surface dark:text-slate-300">{categoryName}</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </>
              ) : null}
              <span className="text-on-surface dark:text-slate-200">Détail</span>
            </nav>
            <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-slate-100 bg-white px-5 py-2.5 text-xs font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="material-symbols-outlined text-sm text-primary">calendar_today</span>
              Publié le {formatDate(listing.created_at)}
            </div>
          </div>

          {/* Hero + sidebar */}
          <div className="mb-12 grid grid-cols-1 gap-10 lg:mb-16 lg:grid-cols-12">
            <div className="group lg:col-span-8">
              <div
                className={`relative aspect-[16/9] overflow-hidden rounded-3xl bg-white ${HERO_SHADOW} dark:bg-slate-900`}
              >
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 flex flex-wrap gap-2 sm:bottom-8 sm:left-8 sm:gap-3">
                  <span className="rounded-full border border-white/40 bg-white/80 px-4 py-2 font-headline text-[10px] font-black uppercase tracking-[0.15em] text-primary backdrop-blur-xl dark:bg-slate-900/80">
                    {typeLabel}
                  </span>
                  <span className="rounded-full border border-white/40 bg-white/80 px-4 py-2 font-headline text-[10px] font-black uppercase tracking-[0.15em] text-primary backdrop-blur-xl dark:bg-slate-900/80">
                    {modeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="glass-card flex h-full flex-col justify-between rounded-[2.5rem] border border-white/40 p-8 dark:border-white/10 md:p-10">
                <div>
                  {listing.user ? (
                    <button
                      type="button"
                      className={`mb-8 flex w-full items-center gap-5 text-left ${onUserClick ? 'cursor-pointer rounded-2xl transition-colors hover:bg-white/40 dark:hover:bg-slate-800/50' : ''}`}
                      onClick={() => onUserClick?.(listing.user!.id)}
                      disabled={!onUserClick}
                    >
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary font-headline text-2xl font-black text-on-primary shadow-lg shadow-primary/20">
                        {listing.user.avatar_url ? (
                          <img
                            src={listing.user.avatar_url}
                            alt=""
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : (
                          listing.user.display_name?.[0]?.toUpperCase() ?? '?'
                        )}
                      </div>
                      <div>
                        <h3 className="font-headline text-xl font-black tracking-tight text-on-surface dark:text-white">
                          {listing.user.display_name}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5">
                          {listing.user.is_verified ? (
                            <span
                              className="material-symbols-outlined text-sm text-blue-500"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              verified
                            </span>
                          ) : null}
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {listing.user.is_verified ? 'Membre vérifié' : 'Membre'}
                          </span>
                        </div>
                        {listing.user.rating_count > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {listing.user.rating_avg.toFixed(1)} · {listing.user.rating_count} avis
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ) : null}

                  <div className="mb-8 flex items-center gap-4 rounded-2xl border border-white/60 bg-white/50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <span className="material-symbols-outlined text-primary">location_on</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Localisation
                      </p>
                      <span className="font-bold text-on-surface dark:text-slate-100">{locationLabel}</span>
                    </div>
                  </div>

                  {/* Actions / proposition */}
                  {isOwnListing && !showProposalForm ? (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={handleToggleEditMode}
                        className="flex w-full items-center justify-center gap-3 rounded-full bg-primary py-5 font-headline text-sm font-black uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                        {editMode ? 'Fermer l’édition' : 'Modifier l’annonce'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setEditError('');
                        }}
                        className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-100 bg-white py-5 font-headline text-sm font-black uppercase tracking-widest text-error transition-all hover:bg-error-container/20 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Supprimer
                      </button>
                    </div>
                  ) : null}

                  {!isOwnListing && user && !showProposalForm ? (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setShowProposalForm(true)}
                        className="flex w-full items-center justify-center gap-3 rounded-full bg-primary py-5 font-headline text-sm font-black uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-lg">handshake</span>
                        Proposer un échange
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        className="w-full py-2 text-center text-sm font-semibold text-slate-500 transition-colors hover:text-error"
                      >
                        Signaler cette annonce
                      </button>
                    </div>
                  ) : null}

                  {!user ? (
                    <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 text-center dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="mb-3 text-sm text-on-surface-variant">Connectez-vous pour proposer un échange</p>
                      <button
                        type="button"
                        onClick={() => onRequestAuth?.('login')}
                        className="w-full rounded-full bg-primary py-3 font-headline text-sm font-bold text-on-primary"
                      >
                        Se connecter
                      </button>
                    </div>
                  ) : null}

                  {!isOwnListing && user && showProposalForm ? (
                    <form onSubmit={handleSubmitProposal} className="space-y-4">
                      <h4 className="font-headline font-bold text-on-surface">Votre proposition</h4>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                          Ce que vous proposez
                        </label>
                        <textarea
                          value={proposalOffer}
                          onChange={(e) => setProposalOffer(e.target.value)}
                          rows={4}
                          required
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-900"
                          placeholder="Décrivez votre contrepartie…"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                          Message
                        </label>
                        <textarea
                          value={proposalMessage}
                          onChange={(e) => setProposalMessage(e.target.value)}
                          rows={3}
                          required
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-900"
                          placeholder="Message personnalisé…"
                        />
                      </div>
                      {proposalError ? (
                        <p className="text-sm text-error">{proposalError}</p>
                      ) : null}
                      <div className="flex flex-col gap-2">
                        <button
                          type="submit"
                          disabled={proposalLoading}
                          className="rounded-full bg-primary py-3 font-headline text-sm font-bold text-on-primary disabled:opacity-50"
                        >
                          {proposalLoading ? 'Envoi…' : 'Envoyer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowProposalForm(false)}
                          className="rounded-full bg-surface-container-high py-3 font-headline text-sm font-bold dark:bg-slate-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Formulaire édition (propriétaire) */}
          {isOwnListing && editMode ? (
            <form
              onSubmit={handleUpdateListing}
              className="glass-card mb-12 space-y-4 rounded-[2.5rem] border border-white/40 p-6 dark:border-white/10 md:p-8"
            >
              <h3 className="font-headline text-lg font-black">Modifier l’annonce</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, type: e.target.value as 'service' | 'product' })
                    }
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="service">Service</option>
                    <option value="product">Produit</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Mode</label>
                  <select
                    value={editForm.mode}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        mode: e.target.value as 'remote' | 'on_site' | 'both',
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="both">Présentiel & à distance</option>
                    <option value="on_site">Présentiel</option>
                    <option value="remote">À distance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Titre</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Offre</label>
                  <textarea
                    value={editForm.description_offer}
                    onChange={(e) => setEditForm({ ...editForm, description_offer: e.target.value })}
                    rows={4}
                    required
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Recherche</label>
                  <textarea
                    value={editForm.desired_exchange_desc}
                    onChange={(e) => setEditForm({ ...editForm, desired_exchange_desc: e.target.value })}
                    rows={4}
                    required
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-600">
                <p className="mb-2 text-sm font-medium">Photo</p>
                <div className="flex flex-wrap gap-4">
                  <div className="h-20 w-28 overflow-hidden rounded-xl bg-slate-100">
                    <img
                      src={newImageUrl || imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">
                    {uploadingImage ? 'Téléversement…' : 'Changer l’image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(e.target.files?.[0] ?? null)}
                      disabled={uploadingImage}
                    />
                  </label>
                  {newImageUrl ? (
                    <button type="button" className="text-xs text-error" onClick={() => setNewImageUrl(null)}>
                      Réinitialiser
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Min (€)"
                  value={editForm.estimation_min}
                  onChange={(e) => setEditForm({ ...editForm, estimation_min: e.target.value })}
                  className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
                <input
                  type="number"
                  placeholder="Max (€)"
                  value={editForm.estimation_max}
                  onChange={(e) => setEditForm({ ...editForm, estimation_max: e.target.value })}
                  className="rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleCancelEdit} className="rounded-full bg-surface-container-high px-6 py-2 font-bold dark:bg-slate-700">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-full bg-primary px-6 py-2 font-bold text-on-primary disabled:opacity-50"
                >
                  {editLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          ) : null}

          {showDeleteConfirm && isOwnListing ? (
            <div className="mb-10 rounded-2xl border border-error-container bg-error-container/20 p-4">
              <p className="mb-3 text-sm text-on-error-container">Supprimer définitivement cette annonce ?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDeleteListing}
                  disabled={deleteLoading}
                  className="rounded-full bg-error px-4 py-2 text-sm font-bold text-on-error disabled:opacity-50"
                >
                  {deleteLoading ? '…' : 'Confirmer'}
                </button>
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded-full bg-slate-200 px-4 py-2 text-sm font-bold dark:bg-slate-700">
                  Annuler
                </button>
              </div>
            </div>
          ) : null}

          {editError ? (
            <div className="mb-8 rounded-xl border border-error-container bg-error-container/15 p-3 text-sm text-on-error-container">
              {editError}
            </div>
          ) : null}

          {/* Grille détails */}
          {!editMode && (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <div className="glass-card rounded-[2.5rem] border border-white/40 border-l-[6px] border-l-primary p-8 dark:border-white/10 md:p-10">
                <div className="mb-8 flex items-center gap-4">
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <span className="material-symbols-outlined text-2xl text-primary">handshake</span>
                  </div>
                  <h2 className="font-headline text-2xl font-black tracking-tight text-on-surface dark:text-white">
                    Ce qui est proposé
                  </h2>
                </div>
                <h1 className="mb-8 font-headline text-3xl font-black leading-[1.1] text-primary md:text-4xl">
                  {listing.title}
                </h1>
                <div className="space-y-6">
                  {bullets.map((point, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="mt-1 rounded-full bg-primary/10 p-1">
                        <span className="material-symbols-outlined text-lg font-bold text-primary">check</span>
                      </div>
                      <p className="leading-relaxed text-slate-600 dark:text-slate-400">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] border border-white/40 border-l-[6px] border-l-secondary-container p-8 dark:border-white/10 md:p-10">
                <div className="mb-8 flex items-center gap-4">
                  <div className="rounded-2xl bg-secondary-container/20 p-3">
                    <span className="material-symbols-outlined text-2xl text-on-secondary-container">
                      search_check
                    </span>
                  </div>
                  <h2 className="font-headline text-2xl font-black tracking-tight text-on-surface dark:text-white">
                    Ce qui est recherché
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {wanted.map((item, i) => (
                    <div
                      key={i}
                      className="group flex cursor-default items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-center gap-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container/10 transition-colors group-hover:bg-secondary-container/25 dark:bg-yellow-900/20">
                          <span className="material-symbols-outlined text-on-secondary-container">
                            {WANTED_ICONS[i % WANTED_ICONS.length]}
                          </span>
                        </div>
                        <span className="font-headline text-lg font-black text-on-surface dark:text-slate-100">
                          {item}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">
                        chevron_right
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Carte */}
          {!editMode && (
            <section className="mt-16 md:mt-20">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <h2 className="flex items-center gap-3 font-headline text-xl font-black text-on-surface dark:text-white">
                  <span className="material-symbols-outlined text-primary">map</span>
                  Localisation
                </h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{mapCaption}</p>
              </div>
              <div
                className={`h-[280px] w-full overflow-hidden rounded-[2.5rem] border border-white bg-white md:h-[400px] dark:border-slate-700 dark:bg-slate-900 ${HERO_SHADOW}`}
              >
                {staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt=""
                    className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center bg-slate-100 px-6 text-center dark:bg-slate-800">
                    <span className="material-symbols-outlined mb-2 text-4xl text-slate-400">map</span>
                    <p className="text-sm font-semibold text-slate-500">
                      {listing.user?.city
                        ? `Zone : ${listing.user.city}`
                        : 'Coordonnées précises non renseignées'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="listing"
        targetId={listing.id}
        targetUserId={listing.user_id}
      />
    </div>
  );
}
