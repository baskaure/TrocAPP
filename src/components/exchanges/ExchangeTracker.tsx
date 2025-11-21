import { useState } from 'react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ExchangeTrackerProps = {
  exchange: any;
  onClose: () => void;
  onUpdate: () => void;
};

export function ExchangeTracker({ exchange, onClose, onUpdate }: ExchangeTrackerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    { id: 'not_started', label: 'Non démarré', icon: Clock },
    { id: 'in_progress', label: 'En cours', icon: Package },
    { id: 'delivered', label: 'Livré', icon: Truck },
    { id: 'confirmed', label: 'Confirmé', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === exchange.status);

  const canMarkAsInProgress = exchange.status === 'not_started';
  const canMarkAsDelivered = exchange.status === 'in_progress';
  const canConfirm = exchange.status === 'delivered';

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

  async function handleMarkAsDelivered() {
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
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
    setLoading(true);
    setError('');

    try {
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
