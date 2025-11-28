import { useState } from 'react';
import { X, FileText, CheckCircle, Download } from 'lucide-react';
import { supabase, Contract } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type ContractModalProps = {
  contract: Contract & {
    proposal?: {
      from_user_id: string;
      to_user_id: string;
      from_user?: { display_name: string };
      to_user?: { display_name: string };
    };
  };
  onClose: () => void;
  onAccepted: () => void;
};

export function ContractModal({ contract, onClose, onAccepted }: ContractModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFullContract, setShowFullContract] = useState(false);

  const isFromUser = contract.proposal?.from_user_id === user?.id;
  const hasUserAccepted = isFromUser ? !!contract.accepted_by_from_at : !!contract.accepted_by_to_at;
  const hasOtherAccepted = isFromUser ? !!contract.accepted_by_to_at : !!contract.accepted_by_from_at;
  const otherPartyName = isFromUser
    ? contract.proposal?.to_user?.display_name
    : contract.proposal?.from_user?.display_name;

  async function handleAccept() {
    // Protection : vérifier qu'on n'a pas déjà accepté
    if (hasUserAccepted) {
      setError('Vous avez déjà accepté ce contrat.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Vérifier à nouveau le statut avant d'accepter (protection contre les doubles clics)
      const { data: currentContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();

      if (!currentContract) {
        throw new Error('Contrat introuvable');
      }

      // Vérifier qu'on n'a pas déjà accepté (double vérification)
      const alreadyAccepted = isFromUser 
        ? !!currentContract.accepted_by_from_at 
        : !!currentContract.accepted_by_to_at;

      if (alreadyAccepted) {
        setError('Vous avez déjà accepté ce contrat.');
        setLoading(false);
        onAccepted(); // Rafraîchir pour mettre à jour l'affichage
        return;
      }

      const updateField = isFromUser ? 'accepted_by_from_at' : 'accepted_by_to_at';

      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          [updateField]: new Date().toISOString(),
        })
        .eq('id', contract.id);

      if (updateError) throw updateError;

      const { data: updatedContract } = await supabase
        .from('contracts')
        .select('accepted_by_from_at, accepted_by_to_at')
        .eq('id', contract.id)
        .single();

      if (updatedContract?.accepted_by_from_at && updatedContract?.accepted_by_to_at) {
        await supabase
          .from('contracts')
          .update({ status: 'active' })
          .eq('id', contract.id);
      }

      onAccepted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
    } finally {
      setLoading(false);
    }
  }

  function downloadContract() {
    const blob = new Blob([contract.html_content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrat-${contract.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Contrat d'échange</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Statut des signatures</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                {hasUserAccepted ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                <span className={hasUserAccepted ? 'text-green-700 font-medium' : 'text-gray-700'}>
                  Vous: {hasUserAccepted ? 'Accepté' : 'En attente'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {hasOtherAccepted ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                <span className={hasOtherAccepted ? 'text-green-700 font-medium' : 'text-gray-700'}>
                  {otherPartyName}: {hasOtherAccepted ? 'Accepté' : 'En attente'}
                </span>
              </div>
            </div>

            {hasUserAccepted && hasOtherAccepted && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <p className="text-green-800 font-medium flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Contrat entièrement signé et actif</span>
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Contenu du contrat</h3>
              <button
                onClick={downloadContract}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div
                className={`p-6 bg-gray-50 overflow-auto ${
                  showFullContract ? 'max-h-96' : 'max-h-48'
                }`}
                dangerouslySetInnerHTML={{ __html: contract.html_content }}
              />
            </div>

            <button
              onClick={() => setShowFullContract(!showFullContract)}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showFullContract ? 'Réduire' : 'Voir le contrat complet'}
            </button>
          </div>

          <div className="border-t pt-6 space-y-3">
            {!hasUserAccepted ? (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    En acceptant ce contrat, vous reconnaissez avoir lu et compris tous les termes et conditions.
                    Le contrat deviendra actif une fois que les deux parties l'auront accepté.
                  </p>
                </div>

                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{loading ? 'Acceptation...' : 'J\'accepte les termes du contrat'}</span>
                </button>
              </>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    Vous avez déjà accepté ce contrat
                    {hasOtherAccepted
                      ? '. L\'échange peut maintenant commencer.'
                      : '. En attente de l\'acceptation de l\'autre partie.'}
                  </span>
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Fermer
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Contrat généré le {new Date(contract.created_at).toLocaleDateString('fr-FR')}</p>
            <p>ID: {contract.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
