import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Exchange, Contract } from '../../lib/supabase';
import { ExchangeTracker } from './ExchangeTracker';
import { ReviewModal } from './ReviewModal';

type ExchangeWithDetails = Exchange & {
  contract?: Contract & {
    proposal?: {
      from_user?: { display_name: string; avatar_url?: string };
      to_user?: { display_name: string; avatar_url?: string };
      listing?: { title: string };
    };
  };
};

export function ExchangesPage() {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeWithDetails | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadExchanges();
    }
  }, [user]);

  async function loadExchanges() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          contract:contracts(
            *,
            proposal:proposals(
              *,
              from_user:users!proposals_from_user_id_fkey(display_name, avatar_url, email),
              to_user:users!proposals_to_user_id_fkey(display_name, avatar_url, email),
              listing:listings(title, type)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered = data?.filter((ex: any) => {
        const proposal = ex.contract?.proposal;
        if (!proposal) return false;
        return proposal.from_user_id === user.id || proposal.to_user_id === user.id;
      }) || [];

      setExchanges(filtered as ExchangeWithDetails[]);
    } catch (error) {
      console.error('Error loading exchanges:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'in_progress':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'delivered':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'confirmed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    const texts = {
      not_started: 'Non démarré',
      in_progress: 'En cours',
      delivered: 'Livré (en attente de confirmation)',
      confirmed: 'Confirmé',
      cancelled: 'Annulé',
    };
    return texts[status as keyof typeof texts] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      not_started: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      delivered: 'bg-orange-100 text-orange-700',
      confirmed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getOtherParty = (exchange: ExchangeWithDetails) => {
    const proposal = exchange.contract?.proposal;
    if (!proposal) return null;

    const fromUserId = (proposal as any).from_user_id;
    if (fromUserId === user?.id) {
      return proposal.to_user;
    }
    return proposal.from_user;
  };

  const filteredExchanges = filterStatus === 'all'
    ? exchanges
    : exchanges.filter(ex => ex.status === filterStatus);

  const canLeaveReview = (exchange: ExchangeWithDetails) => {
    return exchange.status === 'confirmed';
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          Connectez-vous pour voir vos échanges
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes échanges</h1>
        <p className="text-gray-600">Suivez l'état de vos échanges en cours et passés</p>
      </div>

      <div className="mb-6 flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterStatus === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Tous ({exchanges.length})
        </button>
        <button
          onClick={() => setFilterStatus('in_progress')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterStatus === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          En cours
        </button>
        <button
          onClick={() => setFilterStatus('delivered')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterStatus === 'delivered'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          À confirmer
        </button>
        <button
          onClick={() => setFilterStatus('confirmed')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterStatus === 'confirmed'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Terminés
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredExchanges.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun échange
          </h3>
          <p className="text-gray-600">
            {filterStatus === 'all'
              ? "Vous n'avez pas encore d'échange en cours"
              : `Aucun échange ${getStatusText(filterStatus).toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExchanges.map((exchange) => {
            const otherParty = getOtherParty(exchange);
            const proposal = exchange.contract?.proposal;
            const listing = proposal?.listing;
            const daysUntilDue = exchange.due_date
              ? Math.ceil((new Date(exchange.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={exchange.id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {otherParty?.avatar_url ? (
                        <img
                          src={otherParty.avatar_url}
                          alt={otherParty.display_name}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                          {otherParty?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Échange avec {otherParty?.display_name || 'Utilisateur inconnu'}
                      </h3>
                      <p className="text-gray-600 mb-2">
                        {listing?.title || 'Annonce supprimée'}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Créé le {new Date(exchange.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        {exchange.due_date && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              Échéance: {new Date(exchange.due_date).toLocaleDateString('fr-FR')}
                              {daysUntilDue !== null && daysUntilDue > 0 && (
                                <span className="ml-1 text-orange-600 font-medium">
                                  ({daysUntilDue} jour{daysUntilDue > 1 ? 's' : ''})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getStatusColor(exchange.status)}`}>
                      {getStatusIcon(exchange.status)}
                      <span>{getStatusText(exchange.status)}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedExchange(exchange)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Voir les détails
                  </button>

                  {canLeaveReview(exchange) && (
                    <button
                      onClick={() => {
                        setSelectedExchange(exchange);
                        setShowReviewModal(true);
                      }}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Laisser un avis
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedExchange && !showReviewModal && (
        <ExchangeTracker
          exchange={selectedExchange}
          onClose={() => setSelectedExchange(null)}
          onUpdate={loadExchanges}
        />
      )}

      {showReviewModal && selectedExchange && (
        <ReviewModal
          exchange={selectedExchange}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedExchange(null);
          }}
          onSuccess={loadExchanges}
        />
      )}
    </div>
  );
}
