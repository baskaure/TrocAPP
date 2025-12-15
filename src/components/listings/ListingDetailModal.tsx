import { useEffect, useState } from 'react';
import { X, MapPin, Calendar, MessageCircle, Star, CheckCircle, Pencil, Trash2, Flag, Upload, Image as ImageIcon } from 'lucide-react';
import { ReportModal } from '../reports/ReportModal';
import { Listing, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';

type ListingDetailModalProps = {
  listing: Listing | null;
  onClose: () => void;
  onProposalSuccess: () => void;
  onRequestAuth?: (mode: 'login' | 'register') => void;
  onUserClick?: (userId: string) => void;
};

export function ListingDetailModal({ listing, onClose, onProposalSuccess, onRequestAuth, onUserClick }: ListingDetailModalProps) {
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
  }, [listing]);

  if (!listing) return null;

  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800';

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProposalError('');
    setProposalLoading(true);

    try {
      console.log('Creating proposal:', {
        listing_id: listing.id,
        from_user_id: user.id,
        to_user_id: listing.user_id,
      });

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

      if (insertError) {
        console.error('Error creating proposal:', insertError);
        throw insertError;
      }

      console.log('Proposal created successfully:', data);

      setProposalMessage('');
      setProposalOffer('');
      setShowProposalForm(false);
      if (listing.user?.email) {
        sendTransactionalEmail('new_proposal', listing.user.email, {
          listing_title: listing.title,
          proposer_name: user?.display_name,
          proposal_id: data.id,
        });
      }
      onProposalSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error in handleSubmitProposal:', err);
      const errorMessage = err?.message || err?.error_description || 'Une erreur est survenue lors de la création de la proposition';
      setProposalError(errorMessage);
    } finally {
      setProposalLoading(false);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (!next) {
        hydrateEditForm();
      }
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
      const fileName = `${listing?.id || user.id}-${Date.now()}.${ext}`;
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
    } catch (err: any) {
      setEditError(err?.message || "Échec du téléversement de l'image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !isOwnListing) return;

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
        } else {
          const { error: mediaInsertError } = await supabase
            .from('listing_media')
            .insert({
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
    } catch (err: any) {
      setEditError(err?.message || 'Impossible de mettre à jour l’annonce');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!listing || !isOwnListing) return;

    setEditError('');
    setDeleteLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      await onProposalSuccess();
      onClose();
    } catch (err: any) {
      setEditError(err?.message || 'Impossible de supprimer l’annonce');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isOwnListing = user?.id === listing.user_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative my-8 shadow-soft-lg border border-gray-100">
        <button
          onClick={onClose}
          className="fixed sm:absolute top-4 right-4 z-[60] bg-white rounded-full p-2 text-gray-400 hover:text-gray-600 shadow-lg hover:shadow-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full h-40 sm:h-48 md:h-56 overflow-hidden rounded-t-3xl bg-gray-100">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-3 py-1 text-xs sm:text-sm font-medium rounded-full bg-brand-blue/10 text-brand-blue">
                  {listing.type === 'service' ? 'Service' : 'Produit'}
                </span>
                <span className="px-3 py-1 text-xs sm:text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                  {listing.mode === 'remote' ? 'À distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Présentiel & À distance'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-brand-text mb-2">
                {listing.title}
              </h2>
            </div>
          </div>

          {listing.user && (
            <div
              className={`flex items-center space-x-3 pb-4 border-b border-gray-100 mb-6 ${onUserClick ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded-xl transition-colors' : ''}`}
              onClick={() => {
                if (onUserClick && listing.user?.id) {
                  onUserClick(listing.user.id);
                }
              }}
            >
              {listing.user.avatar_url ? (
                <img
                  src={listing.user.avatar_url}
                  alt={listing.user.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-brand-yellow text-white rounded-full flex items-center justify-center text-lg font-medium">
                  {listing.user.display_name[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold text-brand-text ${onUserClick ? 'hover:text-brand-blue' : ''}`}>{listing.user.display_name}</span>
                  {listing.user.is_verified && (
                    <CheckCircle className="w-4 h-4 text-brand-blue" />
                  )}
                </div>
                {listing.user.rating_count > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{listing.user.rating_avg.toFixed(1)}</span>
                    <span>({listing.user.rating_count} avis)</span>
                  </div>
                )}
                {listing.user.city && (
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>{listing.user.city}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                Ce qui est proposé
              </h3>
              <p className="text-gray-800 whitespace-pre-wrap text-sm sm:text-base">{listing.description_offer}</p>
            </div>

            <div className="bg-brand-blue/5 rounded-2xl p-4 border border-brand-blue/15">
              <h3 className="text-sm font-semibold text-brand-blue mb-2 uppercase tracking-wide">
                Ce qui est recherché en échange
              </h3>
              <p className="text-gray-800 whitespace-pre-wrap text-sm sm:text-base">{listing.desired_exchange_desc}</p>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Publié le {formatDate(listing.created_at)}</span>
              </div>
            </div>
          </div>

          {isOwnListing && (
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleToggleEditMode}
                  className="flex items-center space-x-2 btn-secondary border-brand-blue text-brand-blue hover:bg-brand-blue/5"
                >
                  <Pencil className="w-4 h-4" />
                  <span>{editMode ? 'Fermer le formulaire' : "Modifier l'annonce"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setEditError('');
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-full border border-red-300 text-red-700 text-sm font-semibold bg-white hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>

              {editMode && (
                <form onSubmit={handleUpdateListing} className="space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'service' | 'product' })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      >
                        <option value="service">Service</option>
                        <option value="product">Produit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                      <select
                        value={editForm.mode}
                        onChange={(e) => setEditForm({ ...editForm, mode: e.target.value as 'remote' | 'on_site' | 'both' })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      >
                        <option value="both">Présentiel & À distance</option>
                        <option value="on_site">Présentiel uniquement</option>
                        <option value="remote">À distance uniquement</option>
                      </select>
                    </div>
                  </div>

          <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ce que vous offrez</label>
                      <textarea
                        value={editForm.description_offer}
                        onChange={(e) => setEditForm({ ...editForm, description_offer: e.target.value })}
                        rows={4}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ce que vous cherchez</label>
                      <textarea
                        value={editForm.desired_exchange_desc}
                        onChange={(e) => setEditForm({ ...editForm, desired_exchange_desc: e.target.value })}
                        rows={4}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Photo de l’annonce</p>
                    <div className="flex gap-4 items-start">
                      <div className="w-28 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                        {newImageUrl || imageUrl ? (
                          <img
                            src={newImageUrl || imageUrl}
                            alt="Illustration annonce"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-gray-500">
                          Tu peux remplacer la photo actuelle par une nouvelle image.
                        </p>
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium">
                          <Upload className="w-4 h-4" />
                          {uploadingImage ? 'Téléversement...' : 'Uploader une image'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadImage(e.target.files?.[0] || null)}
                            disabled={uploadingImage}
                          />
                        </label>
                        {newImageUrl && (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => setNewImageUrl(null)}
                          >
                            Réinitialiser (garder l’ancienne photo)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimation (optionnel)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Min (€)"
                        value={editForm.estimation_min}
                        onChange={(e) => setEditForm({ ...editForm, estimation_min: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Max (€)"
                        value={editForm.estimation_max}
                        onChange={(e) => setEditForm({ ...editForm, estimation_max: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn-secondary"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="btn-primary"
                    >
                      {editLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              )}

              {showDeleteConfirm && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex flex-col gap-3">
                  <p className="text-sm text-red-700">
                    Cette action est irréversible. Confirmez la suppression de l’annonce.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteListing}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-semibold shadow-sm"
                    >
                      {deleteLoading ? 'Suppression...' : 'Confirmer la suppression'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {editError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
                  {editError}
                </div>
              )}
            </div>
          )}

          {!isOwnListing && user && (
            <div className="border-t border-gray-200 pt-6">
              {!showProposalForm ? (
                <>
                  <button
                    onClick={() => setShowProposalForm(true)}
                    className="w-full btn-primary justify-center gap-2 py-3"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Proposer un échange</span>
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="w-full flex items-center justify-center space-x-2 text-gray-500 hover:text-red-600 py-2 transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                    <span className="text-sm">Signaler cette annonce</span>
                  </button>
                </>
              ) : (
                <form onSubmit={handleSubmitProposal} className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Votre proposition</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ce que vous proposez en échange
                    </label>
                    <textarea
                      value={proposalOffer}
                      onChange={(e) => setProposalOffer(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      placeholder="Décrivez ce que vous proposez..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message
                    </label>
                    <textarea
                      value={proposalMessage}
                      onChange={(e) => setProposalMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                      placeholder="Ajoutez un message personnalisé..."
                      required
                    />
                  </div>

                  {proposalError && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      {proposalError}
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowProposalForm(false)}
                      className="flex-1 btn-secondary"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={proposalLoading}
                      className="flex-1 btn-primary"
                    >
                      {proposalLoading ? 'Envoi...' : 'Envoyer la proposition'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {!user && (
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-700 mb-3">Connectez-vous pour proposer un échange</p>
                <button
                  onClick={() => onRequestAuth?.('login')}
                  className="btn-primary px-6 py-2"
                >
                  Se connecter
                </button>
              </div>
            </div>
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
