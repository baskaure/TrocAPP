import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Calendar, FileText } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Exchange, Contract, Dispute } from '../../lib/supabase';
import { ExchangeTracker } from './ExchangeTracker';
import { ReviewModal } from './ReviewModal';
import { ContractModal } from '../contracts/ContractModal';

type ExchangeWithDetails = Exchange & {
  contract?: Contract & {
    proposal?: {
      from_user?: { display_name: string; avatar_url?: string; email?: string };
      to_user?: { display_name: string; avatar_url?: string; email?: string };
      listing?: { title: string; type?: string };
    };
  };
  dispute?: Dispute | null;
};

type ExchangesPageProps = {
  onUserClick?: (userId: string) => void;
};

export function ExchangesPage({ onUserClick }: ExchangesPageProps) {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeWithDetails | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
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
          dispute:disputes(*),
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

      const normalized = filtered.map((ex: any) => ({
        ...ex,
        dispute: Array.isArray(ex.dispute) ? ex.dispute[0] : ex.dispute,
      }));

      setExchanges(normalized as ExchangeWithDetails[]);
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
        return <Package className="w-5 h-5 text-brand-blue" />;
      case 'delivered':
        return <AlertCircle className="w-5 h-5 text-brand-yellow" />;
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
      in_progress: 'bg-brand-blue/10 text-brand-blue',
      delivered: 'bg-brand-yellow/20 text-brand-yellow',
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
        <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-brand-text mb-1">
          Mes échanges
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Suivez l'état de vos échanges en cours et passés
        </p>
      </div>

      <div className="mb-6 flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${
            filterStatus === 'all'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Tous ({exchanges.length})
        </button>
        <button
          onClick={() => setFilterStatus('in_progress')}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${
            filterStatus === 'in_progress'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          En cours
        </button>
        <button
          onClick={() => setFilterStatus('delivered')}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${
            filterStatus === 'delivered'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          À confirmer
        </button>
        <button
          onClick={() => setFilterStatus('confirmed')}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${
            filterStatus === 'confirmed'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Terminés
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
        </div>
      ) : filteredExchanges.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl shadow-soft-lg border border-gray-100">
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
                className="bg-white rounded-3xl shadow-soft-lg p-6 hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div
                      onClick={(e) => {
                        if (onUserClick && otherParty?.id) {
                          e.stopPropagation();
                          onUserClick(otherParty.id);
                        }
                      }}
                      className={`flex-shrink-0 ${onUserClick && otherParty?.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    >
                      {otherParty?.avatar_url ? (
                        <img
                          src={otherParty.avatar_url}
                          alt={otherParty.display_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-yellow flex items-center justify-center text-white font-semibold shadow-soft-lg">
                          {otherParty?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 
                        onClick={(e) => {
                          if (onUserClick && otherParty?.id) {
                            e.stopPropagation();
                            onUserClick(otherParty.id);
                          }
                        }}
                        className={`text-lg font-heading font-semibold text-brand-text mb-1 ${onUserClick && otherParty?.id ? 'cursor-pointer hover:text-brand-blue transition-colors' : ''}`}
                      >
                        Échange avec {otherParty?.display_name || 'Utilisateur inconnu'}
                      </h3>
                      <p className="text-gray-600 mb-2 text-sm">
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
                    <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center space-x-1 ${getStatusColor(exchange.status)}`}>
                      {getStatusIcon(exchange.status)}
                      <span>{getStatusText(exchange.status)}</span>
                    </span>
                    {exchange.dispute && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          exchange.dispute.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        Litige {exchange.dispute.status === 'resolved' ? 'résolu' : 'en cours'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {exchange.contract && (
                    <button
                      onClick={() => setSelectedContract(exchange.contract as Contract)}
                      className="w-full btn-secondary justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Voir le contrat</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedExchange(exchange)}
                    className="w-full btn-primary justify-center"
                  >
                    Voir le suivi de l'échange
                  </button>

                  {canLeaveReview(exchange) && (
                    <button
                      onClick={() => {
                        setSelectedExchange(exchange);
                        setShowReviewModal(true);
                      }}
                      className="w-full inline-flex items-center justify-center px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold shadow-soft-lg hover:bg-green-700 transition-colors"
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

      {selectedExchange && !showReviewModal && !selectedContract && (
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

      {selectedContract && (
        <ContractModal
          contract={selectedContract as Contract & {
            proposal?: {
              from_user_id: string;
              to_user_id: string;
              from_user?: { display_name: string };
              to_user?: { display_name: string };
            };
          }}
          onClose={() => setSelectedContract(null)}
          onAccepted={loadExchanges}
        />
      )}
    </div>
  );
}
