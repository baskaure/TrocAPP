import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type CreateListingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateListingModal({ isOpen, onClose, onSuccess }: CreateListingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    type: 'service' as 'service' | 'product',
    title: '',
    description_offer: '',
    desired_exchange_desc: '',
    mode: 'both' as 'remote' | 'on_site' | 'both',
    estimation_min: '',
    estimation_max: '',
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { error: insertError } = await supabase.from('listings').insert({
        user_id: user.id,
        type: formData.type,
        title: formData.title,
        description_offer: formData.description_offer,
        desired_exchange_desc: formData.desired_exchange_desc,
        mode: formData.mode,
        estimation_min: formData.estimation_min ? parseFloat(formData.estimation_min) : null,
        estimation_max: formData.estimation_max ? parseFloat(formData.estimation_max) : null,
        status: 'published',
        location_lat: user.geo_lat,
        location_lng: user.geo_lng,
      });

      if (insertError) throw insertError;

      setFormData({
        type: 'service',
        title: '',
        description_offer: '',
        desired_exchange_desc: '',
        mode: 'both',
        estimation_min: '',
        estimation_max: '',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Créer une annonce</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'annonce
            </label>
            <div className="flex space-x-4">
              <label className="flex-1">
                <input
                  type="radio"
                  value="service"
                  checked={formData.type === 'service'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'service' })}
                  className="sr-only"
                />
                <div className={`p-4 border-2 rounded-lg cursor-pointer text-center transition-colors ${formData.type === 'service' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                  <span className="font-medium">Service</span>
                </div>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  value="product"
                  checked={formData.type === 'product'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'product' })}
                  className="sr-only"
                />
                <div className={`p-4 border-2 rounded-lg cursor-pointer text-center transition-colors ${formData.type === 'product' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                  <span className="font-medium">Produit</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre de l'annonce
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Cours de guitare débutant"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ce que vous offrez
            </label>
            <textarea
              value={formData.description_offer}
              onChange={(e) => setFormData({ ...formData, description_offer: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Décrivez en détail ce que vous proposez..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ce que vous recherchez en échange
            </label>
            <textarea
              value={formData.desired_exchange_desc}
              onChange={(e) => setFormData({ ...formData, desired_exchange_desc: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Décrivez ce que vous aimeriez recevoir en échange..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode d'échange
            </label>
            <select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="both">Présentiel et À distance</option>
              <option value="on_site">Présentiel uniquement</option>
              <option value="remote">À distance uniquement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimation de valeur (optionnel, confidentiel)
            </label>
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="number"
                  value={formData.estimation_min}
                  onChange={(e) => setFormData({ ...formData, estimation_min: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min (€)"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={formData.estimation_max}
                  onChange={(e) => setFormData({ ...formData, estimation_max: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Max (€)"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cette information ne sera jamais affichée publiquement
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Publication...' : "Publier l'annonce"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
