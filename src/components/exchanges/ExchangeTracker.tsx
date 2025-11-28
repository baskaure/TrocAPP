import { FormEvent, useState } from 'react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ExchangeTrackerProps = {
  exchange: any;
  onClose: () => void;
  onUpdate: () => void;
};

export function ExchangeTracker({ exchange, onClose, onUpdate }: ExchangeTrackerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const steps = [
    { id: 'not_started', label: 'Non démarré', icon: Clock },
    { id: 'in_progress', label: 'En cours', icon: Package },
    { id: 'delivered', label: 'Livré', icon: Truck },
    { id: 'confirmed', label: 'Confirmé', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === exchange.status);

  // Déterminer qui est l'autre partie
  const proposal = exchange.contract?.proposal;
  const isFromUser = proposal?.from_user_id === user?.id;
  const otherPartyId = isFromUser ? proposal?.to_user_id : proposal?.from_user_id;

  const canMarkAsInProgress = exchange.status === 'not_started';
  const canMarkAsDelivered = exchange.status === 'in_progress';
  // Seul celui qui n'a PAS marqué comme livré peut confirmer
  const canConfirm = exchange.status === 'delivered' && exchange.delivered_by !== user?.id;
  const canOpenDispute = exchange.status === 'delivered' || exchange.status === 'in_progress';
  const shouldShowDisputeSection = canOpenDispute || Boolean(exchange.dispute);

  async function handleStartExchange() {
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({ status: 'in_progress' })
        .eq('id', exchange.id);

      if (updateError) throw updateError;

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDispute(e: FormEvent) {
    e.preventDefault();
    if (!disputeReason.trim()) return;
    if (!user) {
      setDisputeError('Session expirée, veuillez vous reconnecter.');
      return;
    }
    setDisputeLoading(true);
    setDisputeError('');

    try {
      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          exchange_id: exchange.id,
          opened_by: user?.id,
          reason: disputeReason,
          status: 'open',
        });

      if (disputeError) throw disputeError;
      setShowDisputeForm(false);
      setDisputeReason('');
      onUpdate();
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Impossible d\'ouvrir un litige');
    } finally {
      setDisputeLoading(false);
    }
  }

  async function handleMarkAsDelivered() {
    setLoading(true);
    setError('');

    try {
      if (!user?.id) {
        setError('Session expirée, veuillez vous reconnecter.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_by: user.id, // Enregistrer qui a marqué comme livré
        })
        .eq('id', exchange.id);

      if (updateError) throw updateError;

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la livraison');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!user?.id) {
      setError('Session expirée, veuillez vous reconnecter.');
      return;
    }

    // Vérifier qu'on n'est pas celui qui a marqué comme livré
    if (exchange.delivered_by === user.id) {
      setError('Vous ne pouvez pas confirmer la réception d\'un échange que vous avez marqué comme livré.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Vérifier à nouveau avant la mise à jour (protection contre les doubles clics)
      const { data: currentExchange } = await supabase
        .from('exchanges')
        .select('delivered_by, status')
        .eq('id', exchange.id)
        .single();

      if (!currentExchange) {
        throw new Error('Échange introuvable');
      }

      if (currentExchange.delivered_by === user.id) {
        setError('Vous ne pouvez pas confirmer la réception d\'un échange que vous avez marqué comme livré.');
        setLoading(false);
        return;
      }

      if (currentExchange.status !== 'delivered') {
        setError('Cet échange n\'est pas en statut "livré".');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', exchange.id);

      if (updateError) throw updateError;

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Suivi de l'échange</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.id} className="relative flex items-start mb-8 last:mb-0">
                  <div
                    className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="ml-4 flex-1">
                    <h3
                      className={`text-lg font-semibold ${
                        isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </h3>

                    {step.id === 'not_started' && (
                      <p className="text-sm text-gray-600 mt-1">
                        L'échange n'a pas encore commencé. Cliquez sur "Démarrer" pour commencer.
                      </p>
                    )}

                    {step.id === 'in_progress' && isCurrent && (
                      <p className="text-sm text-gray-600 mt-1">
                        Échange en cours. Marquez comme livré quand vous avez terminé votre partie.
                      </p>
                    )}

                    {step.id === 'delivered' && isCurrent && (
                      <div className="mt-1">
                        <p className="text-sm text-gray-600">
                          En attente de confirmation de l'autre partie.
                        </p>
                        {exchange.delivered_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Livré le {new Date(exchange.delivered_at).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    )}

                    {step.id === 'confirmed' && isCompleted && (
                      <div className="mt-1">
                        <p className="text-sm text-green-600 font-medium">
                          Échange terminé avec succès !
                        </p>
                        {exchange.confirmed_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Confirmé le {new Date(exchange.confirmed_at).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {exchange.due_date && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-900">
                <Clock className="w-5 h-5" />
                <div>
                  <p className="font-medium">Date limite</p>
                  <p className="text-sm">
                    {new Date(exchange.due_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4">
            {canMarkAsInProgress && (
              <button
                onClick={handleStartExchange}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? 'Démarrage...' : 'Démarrer l\'échange'}
              </button>
            )}

            {canMarkAsDelivered && (
              <button
                onClick={handleMarkAsDelivered}
                disabled={loading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? 'Enregistrement...' : 'Marquer comme livré'}
              </button>
            )}

            {canConfirm && (
              <button
                onClick={handleConfirmDelivery}
                disabled={loading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? 'Confirmation...' : 'Confirmer la réception'}
              </button>
            )}

            {shouldShowDisputeSection && (
              <div className="border border-red-100 rounded-lg p-4 space-y-3 bg-red-50/30">
                {exchange.dispute ? (
                  <div className="flex items-start space-x-2 text-red-700">
                    <AlertCircle className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {exchange.dispute.status === 'resolved' ? 'Litige résolu' : 'Litige en cours'}
                      </p>
                      <p className="text-sm">
                        Statut : <span className="capitalize">{exchange.dispute.status}</span>
                      </p>
                      {exchange.dispute.resolution && (
                        <p className="text-sm text-gray-700 mt-1">
                          Résolution proposée : {exchange.dispute.resolution}
                        </p>
                      )}
                      {exchange.dispute.resolution_notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          Notes : {exchange.dispute.resolution_notes}
                        </p>
                      )}
                    </div>
                  </div>
                ) : canOpenDispute ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDisputeForm(prev => !prev)}
                      className="w-full text-sm text-red-600 font-medium hover:text-red-700"
                    >
                      {showDisputeForm ? 'Annuler le litige' : 'Ouvrir un litige'}
                    </button>
                    {showDisputeForm && (
                      <form onSubmit={handleOpenDispute} className="space-y-3">
                        <textarea
                          value={disputeReason}
                          onChange={e => setDisputeReason(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                          rows={3}
                          placeholder="Expliquez le problème rencontré..."
                          required
                        />
                        {disputeError && (
                          <p className="text-sm text-red-600 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>{disputeError}</span>
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={disputeLoading || !disputeReason.trim()}
                          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {disputeLoading ? 'Envoi...' : 'Envoyer le litige'}
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    Litige clôturé. Contactez le support si vous avez besoin de rouvrir le dossier.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
