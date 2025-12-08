import { useState } from 'react';
import { X, MessageCircle, CheckCircle, XCircle, Send } from 'lucide-react';
import { supabase, Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { ChatWindow } from '../chat/ChatWindow';
import { sendTransactionalEmail } from '../../lib/notifications';
import { enqueueEsignRequest, isEsignEnabled } from '../../lib/esign';

type ProposalDetailModalProps = {
  proposal: Proposal | null;
  onClose: () => void;
  onUpdate: () => void;
  onUserClick?: (userId: string) => void;
};

export function ProposalDetailModal({ proposal, onClose, onUpdate, onUserClick }: ProposalDetailModalProps) {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!proposal) return null;

  const isReceiver = proposal.to_user_id === user?.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;

  const handleAccept = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id);

      if (updateError) {
        console.error('Error updating proposal:', updateError);
        throw updateError;
      }

      const { error: contractFnError } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (contractFnError) {
        console.error('Error generating contract via edge function:', contractFnError);
        throw contractFnError;
      }

      const listingTitle = proposal.listing?.title || 'Votre échange';
      sendTransactionalEmail('contract_ready', proposal.from_user?.email, {
        listing_title: listingTitle,
        proposal_id: proposal.id,
        counterpart_name: proposal.to_user?.display_name,
      });
      if (proposal.to_user?.email && proposal.to_user.email !== proposal.from_user?.email) {
        sendTransactionalEmail('contract_ready', proposal.to_user.email, {
          listing_title: listingTitle,
          proposal_id: proposal.id,
          counterpart_name: proposal.from_user?.display_name,
        });
      }

      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('proposal_id', proposal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Signature électronique désactivée temporairement
      // Le contrat est généré et peut être téléchargé/signé manuellement
      if (contract?.id && isEsignEnabled()) {
        try {
          await enqueueEsignRequest({
            contractId: contract.id,
            listingTitle,
            participants: [
              {
                id: proposal.from_user_id,
                email: proposal.from_user?.email,
                name: proposal.from_user?.display_name,
              },
              {
                id: proposal.to_user_id,
                email: proposal.to_user?.email,
                name: proposal.to_user?.display_name,
              },
            ],
          });
        } catch (esignError) {
          console.warn('Impossible de préparer la signature électronique', esignError);
        }
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error accepting proposal:', err);
      const errorMessage = err?.message || err?.error_description || 'Une erreur est survenue lors de l\'acceptation';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposal.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error refusing proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('proposals').insert({
        listing_id: proposal.listing_id,
        from_user_id: user!.id,
        to_user_id: otherUser!.id,
        message: counterMessage,
        offer_payload: { description: counterOffer },
        status: 'pending',
        parent_proposal_id: proposal.id,
      });

      if (error) throw error;

      await supabase
        .from('proposals')
        .update({ status: 'countered' })
        .eq('id', proposal.id);

      setShowCounterForm(false);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error countering proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full relative my-8 shadow-soft-lg border border-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex items-start space-x-4 mb-6">
            <div
              onClick={() => {
                if (onUserClick && otherUser?.id) {
                  onClose();
                  onUserClick(otherUser.id);
                }
              }}
              className={`flex-shrink-0 ${onUserClick && otherUser?.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            >
              {otherUser?.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt={otherUser.display_name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-brand-yellow text-white rounded-full flex items-center justify-center text-2xl">
                  {otherUser?.display_name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-heading font-semibold mb-1 text-brand-text">
                {proposal.listing?.title}
              </h2>
              <p 
                onClick={() => {
                  if (onUserClick && otherUser?.id) {
                    onClose();
                    onUserClick(otherUser.id);
                  }
                }}
                className={`text-gray-600 text-sm sm:text-base ${onUserClick && otherUser?.id ? 'cursor-pointer hover:text-brand-blue transition-colors' : ''}`}
              >
                Proposition {isReceiver ? 'de' : 'pour'} {otherUser?.display_name}
              </p>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  proposal.status === 'refused' ? 'bg-red-100 text-red-700' :
                  proposal.status === 'countered' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {proposal.status === 'accepted' ? 'Acceptée' :
                   proposal.status === 'refused' ? 'Refusée' :
                   proposal.status === 'countered' ? 'Contre-proposition' :
                   'En attente'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">Proposition</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{proposal.message}</p>
            </div>

            {proposal.offer_payload?.description && (
              <div className="bg-brand-blue/5 rounded-2xl p-4 border border-brand-blue/15">
                <h3 className="text-sm font-semibold text-brand-blue mb-2 uppercase tracking-wide">En échange</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {proposal.offer_payload.description}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
              {error}
            </div>
          )}

          {!showChat && !showCounterForm && proposal.status === 'pending' && isReceiver && (
            <div className="flex space-x-3 mb-4">
              <button
                onClick={handleAccept}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-500 text-white py-3 px-4 rounded-full hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Accepter</span>
              </button>
              <button
                onClick={() => setShowCounterForm(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-brand-yellow text-white py-3 px-4 rounded-full hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                <span>Contre-proposer</span>
              </button>
              <button
                onClick={handleRefuse}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-red-500 text-white py-3 px-4 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                <span>Refuser</span>
              </button>
            </div>
          )}

          {showCounterForm && (
            <form onSubmit={handleCounter} className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre contre-proposition
                </label>
                <textarea
                  value={counterOffer}
                  onChange={(e) => setCounterOffer(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCounterForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-full hover:bg-gray-50 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-primary rounded-full py-2 disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
            </form>
          )}

          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full flex items-center justify-center space-x-2 border border-brand-blue text-brand-blue py-2.5 px-4 rounded-full hover:bg-brand-blue/5 transition-colors text-sm font-medium"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{showChat ? 'Masquer' : 'Ouvrir'} la discussion</span>
          </button>

          {showChat && <ChatWindow proposalId={proposal.id} onUserClick={onUserClick} />}
        </div>
      </div>
    </div>
  );
}
