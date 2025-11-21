import { useEffect, useState } from 'react';
import { MessageCircle, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase, Proposal } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ProposalsListProps = {
  onSelectProposal: (proposal: Proposal) => void;
};

export function ProposalsList({ onSelectProposal }: ProposalsListProps) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  useEffect(() => {
    if (user) {
      loadProposals();
    }
  }, [user, filter]);

  async function loadProposals() {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('proposals')
        .select(`
          *,
          from_user:users!proposals_from_user_id_fkey(*),
          to_user:users!proposals_to_user_id_fkey(*),
          listing:listings(*)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'sent') {
        query = query.eq('from_user_id', user.id);
      } else if (filter === 'received') {
        query = query.eq('to_user_id', user.id);
      } else {
        query = query.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error loading proposals:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'refused':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'countered':
        return <RefreshCw className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'En attente',
      countered: 'Contre-proposition',
      accepted: 'Acceptée',
      refused: 'Refusée',
      cancelled: 'Annulée',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium ${filter === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Toutes
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`px-4 py-2 font-medium ${filter === 'sent' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Envoyées
        </button>
        <button
          onClick={() => setFilter('received')}
          className={`px-4 py-2 font-medium ${filter === 'received' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Reçues
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Aucune proposition pour le moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const otherUser = proposal.from_user_id === user?.id ? proposal.to_user : proposal.from_user;
            const isSent = proposal.from_user_id === user?.id;

            return (
              <div
                key={proposal.id}
                onClick={() => onSelectProposal(proposal)}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {getStatusIcon(proposal.status)}
                      <span className="font-medium text-sm">{getStatusText(proposal.status)}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{isSent ? 'Envoyée' : 'Reçue'}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{proposal.listing?.title}</h3>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-3">
                  {otherUser?.avatar_url ? (
                    <img
                      src={otherUser.avatar_url}
                      alt={otherUser.display_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                      {otherUser?.display_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{otherUser?.display_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(proposal.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">{proposal.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
