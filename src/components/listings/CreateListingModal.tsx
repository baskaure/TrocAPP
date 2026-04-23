import { useEffect, useMemo, useState, useRef } from 'react';
import { supabase, type Category } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';

type CreateListingModalProps = {
  onBack: () => void;
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

const fieldClass =
  'w-full border-none bg-surface-container-low px-6 py-4 font-inter font-medium text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 rounded-lg';
const sectionLabelClass =
  'block text-sm font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400';

export function CreateListingModal({ onBack, onSuccess, categories = [] }: CreateListingModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    [categories, formData.category_id],
  );

  const defaultImageUrl = useMemo(
    () => getDefaultImage(selectedCategory?.slug, formData.type),
    [selectedCategory?.slug, formData.type],
  );

  const previewUrl = customImageUrl || defaultImageUrl;

  useEffect(() => {
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
  }, []);

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
    } catch (err: unknown) {
      console.error(err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : "Échec du téléversement";
      setError(msg);
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
          desired_exchange_desc: formData.desired_exchange_desc || '',
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
      onBack();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Une erreur est survenue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const modeOptions: { value: typeof formData.mode; label: string; icon: string }[] = [
    { value: 'remote', label: 'À distance', icon: 'devices' },
    { value: 'on_site', label: 'Présentiel', icon: 'person_pin_circle' },
    { value: 'both', label: 'Mixte', icon: 'dynamic_feed' },
  ];

  return (
    <div className="w-full max-w-5xl pb-24">
      <form onSubmit={handleSubmit}>
        <PageBackLink onClick={onBack} label="Retour aux annonces" />

        {/* En-tête */}
        <div className="mb-10 md:mb-12">
          <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
            Créer une annonce
          </h1>
          <p className="max-w-2xl font-inter text-base leading-relaxed text-on-surface-variant md:text-lg">
            Partagez ce que vous proposez et ce que vous cherchez en échange — le troc local et équitable, sans friction.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Colonne formulaire */}
          <div className="space-y-8 lg:col-span-8">
            {/* Section identité */}
            <section className="space-y-8 rounded-xl bg-surface-container-lowest p-8 shadow-sm dark:border dark:border-outline-variant/10 dark:bg-slate-900 md:p-12">
              <div className="space-y-4">
                <span className={sectionLabelClass}>Type de troc</span>
                <div className="flex max-w-sm rounded-xl bg-surface-container-low p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'product' })}
                    className={`flex-1 rounded-lg px-6 py-3 text-sm font-bold transition-all ${
                      formData.type === 'product'
                        ? 'bg-surface-container-lowest text-primary shadow-sm dark:bg-slate-900'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Produit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'service' })}
                    className={`flex-1 rounded-lg px-6 py-3 text-sm font-bold transition-all ${
                      formData.type === 'service'
                        ? 'bg-surface-container-lowest text-primary shadow-sm dark:bg-slate-900'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Service
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label htmlFor="create-category" className={sectionLabelClass}>
                  Catégorie
                </label>
                <div className="relative">
                  <select
                    id="create-category"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className={`${fieldClass} appearance-none pr-12`}
                  >
                    <option value="">Choisir une catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[22px]">expand_more</span>
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <label htmlFor="create-title" className={sectionLabelClass}>
                  Titre de l&apos;annonce
                </label>
                <input
                  id="create-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={fieldClass}
                  placeholder="Ex : cours de guitare, réparation vélo, plantes d'intérieur…"
                  required
                />
              </div>
            </section>

            {/* Section contenu */}
            <section className="space-y-8 rounded-xl bg-surface-container-lowest p-8 shadow-sm dark:border dark:border-outline-variant/10 dark:bg-slate-900 md:p-12">
              <div className="space-y-4">
                <label htmlFor="create-offer" className={sectionLabelClass}>
                  Ce que vous offrez
                </label>
                <textarea
                  id="create-offer"
                  value={formData.description_offer}
                  onChange={(e) => setFormData({ ...formData, description_offer: e.target.value })}
                  rows={4}
                  className={fieldClass}
                  placeholder="Décrivez en détail votre offre…"
                  required
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="create-wanted" className={sectionLabelClass}>
                    Ce que vous recherchez
                  </label>
                  <span className="rounded bg-secondary-container/15 px-2 py-1 text-xs font-bold text-on-secondary-container">
                    Optionnel
                  </span>
                </div>
                <textarea
                  id="create-wanted"
                  value={formData.desired_exchange_desc}
                  onChange={(e) => setFormData({ ...formData, desired_exchange_desc: e.target.value })}
                  rows={4}
                  className={fieldClass}
                  placeholder="Produits ou services que vous aimeriez recevoir en échange…"
                />
              </div>
            </section>

            {/* Section logistique */}
            <section className="space-y-8 rounded-xl bg-surface-container-lowest p-8 shadow-sm dark:border dark:border-outline-variant/10 dark:bg-slate-900 md:p-12">
              <div className="space-y-4">
                <span className={sectionLabelClass}>Mode d&apos;échange</span>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {modeOptions.map((opt) => {
                    const active = formData.mode === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`group relative flex cursor-pointer flex-col rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container dark:bg-slate-800 ${
                          active ? 'ring-2 ring-primary/40' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="exchange-mode"
                          value={opt.value}
                          checked={active}
                          onChange={() => setFormData({ ...formData, mode: opt.value })}
                          className="absolute right-4 top-4 text-primary focus:ring-primary"
                        />
                        <span
                          className={`material-symbols-outlined mb-2 text-[28px] ${active ? 'text-primary' : 'text-outline group-hover:text-primary'}`}
                        >
                          {opt.icon}
                        </span>
                        <span className="text-sm font-bold text-on-surface">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={sectionLabelClass}>Valeur estimée</span>
                  <span
                    className="material-symbols-outlined cursor-help text-sm text-outline"
                    title="Confidentiel — aide à équilibrer les propositions"
                  >
                    info
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.estimation_min}
                      onChange={(e) => setFormData({ ...formData, estimation_min: e.target.value })}
                      className={`${fieldClass} pl-10`}
                      placeholder="Min"
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">€</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.estimation_max}
                      onChange={(e) => setFormData({ ...formData, estimation_max: e.target.value })}
                      className={`${fieldClass} pl-10`}
                      placeholder="Max"
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">€</span>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">Non affiché publiquement.</p>
              </div>
            </section>

            {error ? (
              <div className="rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">{error}</div>
            ) : null}

            {/* Actions (visibles sur tout écran ; mise en avant desktop comme le mockup) */}
            <div className="hidden flex-col gap-4 border-t border-outline-variant/15 pt-8 md:flex md:flex-row">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-full border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low dark:border-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] rounded-full bg-primary py-4 font-headline font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Publication…' : "Publier l'annonce"}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-28">
            <div className="space-y-6 rounded-xl bg-surface-container-lowest p-6 shadow-sm dark:border dark:border-outline-variant/10 dark:bg-slate-900">
              <span className={sectionLabelClass}>Visuel de l&apos;annonce</span>
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-container-high dark:bg-slate-800">
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-6 py-3 font-headline text-sm font-bold text-on-surface shadow-xl"
                  >
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    {uploading ? 'Envoi…' : 'Modifier'}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </div>
              {customImageUrl ? (
                <button
                  type="button"
                  onClick={() => setCustomImageUrl(null)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Réinitialiser l’image suggérée
                </button>
              ) : null}
              <div className="flex items-start gap-3 rounded-xl bg-secondary-container/10 p-4 dark:bg-secondary-container/20">
                <span className="material-symbols-outlined shrink-0 text-secondary-container">lightbulb</span>
                <p className="text-xs font-medium leading-tight text-on-secondary-container">
                  Une photo claire augmente les chances qu’on vous contacte pour un échange.
                </p>
              </div>
            </div>

            <div className="space-y-6 rounded-xl bg-surface-container-low p-8 dark:bg-slate-800/80">
              <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">Conseils</h3>
              <ul className="space-y-4">
                {[
                  'Soyez précis sur ce que vous offrez et ce que vous attendez.',
                  'Une fourchette de valeur aide à proposer des échanges équilibrés.',
                  'Indiquez vos disponibilités ou contraintes dans la description.',
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm text-on-surface-variant">{text}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions mobile : sous la sidebar pour rester accessible */}
            <div className="flex flex-col gap-4 pt-2 md:hidden">
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-full border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface-variant"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-primary py-4 font-headline font-bold text-on-primary shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? 'Publication…' : "Publier l'annonce"}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
