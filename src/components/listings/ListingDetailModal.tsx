import { useState } from 'react';
import { X, MapPin, Calendar, MessageCircle, Star, CheckCircle } from 'lucide-react';
import { Listing, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ListingDetailModalProps = {
  listing: Listing | null;
  onClose: () => void;
  onProposalSuccess: () => void;
};

export function ListingDetailModal({ listing, onClose, onProposalSuccess }: ListingDetailModalProps) {
  const { user } = useAuth();
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalOffer, setProposalOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!listing) return null;

  const imageUrl = listing.media && listing.media.length > 0
    ? listing.media[0].url
    : 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800';

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

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
      onProposalSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error in handleSubmitProposal:', err);
      const errorMessage = err?.message || err?.error_description || 'Une erreur est survenue lors de la création de la proposition';
      setError(errorMessage);
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 text-gray-400 hover:text-gray-600 shadow-md"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-gray-100">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                  {listing.type === 'service' ? 'Service' : 'Produit'}
                </span>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                  {listing.mode === 'remote' ? 'À distance' : listing.mode === 'on_site' ? 'Présentiel' : 'Présentiel & À distance'}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{listing.title}</h2>
            </div>
          </div>

          {listing.user && (
            <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 mb-6">
              {listing.user.avatar_url ? (
                <img
                  src={listing.user.avatar_url}
                  alt={listing.user.display_name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-medium">
                  {listing.user.display_name[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{listing.user.display_name}</span>
                  {listing.user.is_verified && (
                    <CheckCircle className="w-4 h-4 text-blue-600" />
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ce qui est proposé</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{listing.description_offer}</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ce qui est recherché en échange</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{listing.desired_exchange_desc}</p>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Publié le {formatDate(listing.created_at)}</span>
              </div>
            </div>
          </div>

          {!isOwnListing && user && (
            <div className="border-t border-gray-200 pt-6">
              {!showProposalForm ? (
                <button
                  onClick={() => setShowProposalForm(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Proposer un échange</span>
                </button>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ajoutez un message personnalisé..."
                      required
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowProposalForm(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Envoi...' : 'Envoyer la proposition'}
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
                <button className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
                  Se connecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
