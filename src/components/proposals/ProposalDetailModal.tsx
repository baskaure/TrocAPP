import { useState } from 'react';
import { X, MessageCircle, CheckCircle, XCircle, Send } from 'lucide-react';
import { supabase, Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { ChatWindow } from '../chat/ChatWindow';

type ProposalDetailModalProps = {
  proposal: Proposal | null;
  onClose: () => void;
  onUpdate: () => void;
};

export function ProposalDetailModal({ proposal, onClose, onUpdate }: ProposalDetailModalProps) {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [loading, setLoading] = useState(false);

  if (!proposal) return null;

  const isReceiver = proposal.to_user_id === user?.id;
  const otherUser = isReceiver ? proposal.from_user : proposal.to_user;

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id);

      if (error) throw error;

      const { error: contractError } = await supabase.from('contracts').insert({
        proposal_id: proposal.id,
        html_content: generateContractHTML(proposal),
        status: 'awaiting_signatures',
      });

      if (contractError) throw contractError;

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error accepting proposal:', error);
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

  const generateContractHTML = (proposal: Proposal) => {
    return `
      <h1>Contrat d'Échange</h1>
      <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
      <h2>Parties</h2>
      <p>Entre: ${proposal.from_user?.display_name}</p>
      <p>Et: ${proposal.to_user?.display_name}</p>
      <h2>Objet de l'échange</h2>
      <p>${proposal.message}</p>
      <h2>Conditions</h2>
      <p>Les parties s'engagent à réaliser l'échange tel que décrit ci-dessus.</p>
    `;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-start space-x-4 mb-6">
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.display_name}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl">
                {otherUser?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">{proposal.listing?.title}</h2>
              <p className="text-gray-600">
                Proposition {isReceiver ? 'de' : 'pour'} {otherUser?.display_name}
              </p>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
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
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Proposition</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{proposal.message}</p>
            </div>

            {proposal.offer_payload?.description && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">En échange</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {proposal.offer_payload.description}
                </p>
              </div>
            )}
          </div>

          {!showChat && !showCounterForm && proposal.status === 'pending' && isReceiver && (
            <div className="flex space-x-3 mb-4">
              <button
                onClick={handleAccept}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Accepter</span>
              </button>
              <button
                onClick={() => setShowCounterForm(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                <span>Contre-proposer</span>
              </button>
              <button
                onClick={handleRefuse}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCounterForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
            </form>
          )}

          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full flex items-center justify-center space-x-2 border-2 border-blue-600 text-blue-600 py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{showChat ? 'Masquer' : 'Ouvrir'} la discussion</span>
          </button>

          {showChat && <ChatWindow proposalId={proposal.id} />}
        </div>
      </div>
    </div>
  );
}
