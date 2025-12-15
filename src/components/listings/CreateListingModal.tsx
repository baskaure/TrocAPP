import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { supabase, type Category } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type CreateListingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories?: Category[];
};

const DEFAULT_IMAGES: Record<string, string> = {
  informatique: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  maison: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  services: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  sport: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
  arts: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  education: 'https://images.unsplash.com/photo-1516383607781-913a19294fd1?auto=format&fit=crop&w=1200&q=80',
  mode: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
  mobilier: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
  __service__: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
  __product__: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  __default__: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
};

function getDefaultImage(categorySlug: string | undefined, type: 'service' | 'product') {
  if (categorySlug && DEFAULT_IMAGES[categorySlug]) return DEFAULT_IMAGES[categorySlug];
  if (type === 'service' && DEFAULT_IMAGES.__service__) return DEFAULT_IMAGES.__service__;
  if (type === 'product' && DEFAULT_IMAGES.__product__) return DEFAULT_IMAGES.__product__;
  return DEFAULT_IMAGES.__default__;
}

export function CreateListingModal({ isOpen, onClose, onSuccess, categories = [] }: CreateListingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'service' as 'service' | 'product',
    category_id: '',
    title: '',
    description_offer: '',
    desired_exchange_desc: '',
    mode: 'both' as 'remote' | 'on_site' | 'both',
    estimation_min: '',
    estimation_max: '',
  });

  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === formData.category_id),
    [categories, formData.category_id]
  );

  const defaultImageUrl = useMemo(
    () => getDefaultImage(selectedCategory?.slug, formData.type),
    [selectedCategory?.slug, formData.type]
  );

  useEffect(() => {
    if (!isOpen) {
      setCustomImageUrl(null);
      setFormData({
        type: 'service',
        category_id: '',
        title: '',
        description_offer: '',
        desired_exchange_desc: '',
        mode: 'both',
        estimation_min: '',
        estimation_max: '',
      });
      setError('');
      setUploading(false);
    }
  }, [isOpen]);

  const handleUpload = async (file?: File | null) => {
    if (!file || !user) return;

    setUploading(true);
    setError('');

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('listing-media')
        .upload(`images/${fileName}`, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('listing-media').getPublicUrl(`images/${fileName}`);
      if (!data?.publicUrl) throw new Error("Impossible de récupérer l'URL publique");

      setCustomImageUrl(data.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Échec du téléversement de l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { data: listingRows, error: insertError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          type: formData.type,
          category_id: formData.category_id || null,
          title: formData.title,
          description_offer: formData.description_offer,
          desired_exchange_desc: formData.desired_exchange_desc,
          mode: formData.mode,
          estimation_min: formData.estimation_min ? parseFloat(formData.estimation_min) : null,
          estimation_max: formData.estimation_max ? parseFloat(formData.estimation_max) : null,
          status: 'published',
          location_lat: user.geo_lat,
          location_lng: user.geo_lng,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const listingId = listingRows?.id;
      const finalImageUrl = customImageUrl || defaultImageUrl;

      if (listingId && finalImageUrl) {
        const { error: mediaError } = await supabase.from('listing_media').insert({
          listing_id: listingId,
          url: finalImageUrl,
          type: 'image',
          sort_order: 0,
        });
        if (mediaError) throw mediaError;
      }

      setFormData({
        type: 'service',
        category_id: '',
        title: '',
        description_offer: '',
        desired_exchange_desc: '',
        mode: 'both',
        estimation_min: '',
        estimation_max: '',
      });
      setCustomImageUrl(null);

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 relative my-8 shadow-soft-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-heading font-semibold mb-1 text-brand-text">
          Créer une annonce
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Décrivez ce que vous offrez et ce que vous cherchez en échange. Tout est pensé pour le troc équitable.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
            >
              <option value="">Choisir une catégorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Utilisé pour pré-sélectionner une photo adaptée (modifiable ensuite)
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex gap-4 items-start">
            <div className="w-28 h-20 rounded-xl overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
              {customImageUrl || defaultImageUrl ? (
                <img
                  src={customImageUrl || defaultImageUrl}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-gray-700 font-medium">
                Photo pré-sélectionnée selon le thème
              </p>
              <p className="text-xs text-gray-500">
                Une photo est choisie automatiquement (catégorie ou type). Tu peux la remplacer en uploadant la tienne.
              </p>
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium">
                <Upload className="w-4 h-4" />
                {uploading ? 'Téléversement...' : 'Uploader une image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </label>
              {customImageUrl && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setCustomImageUrl(null)}
                >
                  Réinitialiser vers la photo par défaut
                </button>
              )}
            </div>
          </div>

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
                <div className={`p-4 border-2 rounded-xl cursor-pointer text-center transition-colors ${formData.type === 'service' ? 'border-brand-blue bg-brand-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
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
                <div className={`p-4 border-2 rounded-xl cursor-pointer text-center transition-colors ${formData.type === 'product' ? 'border-brand-blue bg-brand-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:bg-white bg-gray-50"
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
              className="flex-1 px-4 py-2 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary rounded-full"
            >
              {loading ? 'Publication...' : "Publier l'annonce"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
