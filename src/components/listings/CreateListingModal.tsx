import { useMemo, useState, useRef, type FormEvent } from 'react';
import { supabase, errorMessage, type Category } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackLink } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { checkContent } from '../../lib/moderation';
import { IMAGE_ACCEPT, prepareImage, storagePathFromPublicUrl } from '../../lib/image';
import { listingPlaceholder } from './placeholders';

type CreateListingModalProps = {
  onBack: () => void;
  onSuccess: () => void;
  categories?: Category[];
};

const fieldClass =
  'w-full border-none bg-surface-container-low px-6 py-4 font-inter font-medium text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 rounded-lg';
const sectionLabelClass = 'block text-sm font-bold uppercase tracking-widest text-on-surface-variant';

const EMPTY_FORM = {
  type: 'service' as 'service' | 'product',
  category_id: '',
  title: '',
  description_offer: '',
  desired_exchange_desc: '',
  mode: 'both' as 'remote' | 'on_site' | 'both',
  estimation_min: '',
  estimation_max: '',
};

export function CreateListingModal({ onBack, onSuccess, categories = [] }: CreateListingModalProps) {
  const { user } = useAuth();
  const { toast } = useNotice();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);

  const selectedCategory = useMemo(() => categories.find((c) => c.id === formData.category_id), [categories, formData.category_id]);
  const placeholder = useMemo(
    () => listingPlaceholder({ type: formData.type, category: selectedCategory ? { slug: selectedCategory.slug, name: selectedCategory.name } : null }),
    [formData.type, selectedCategory],
  );

  const removeUploaded = async (url: string | null) => {
    const path = storagePathFromPublicUrl(url, 'listing-media');
    if (path) await supabase.storage.from('listing-media').remove([path]);
  };

  const handleUpload = async (file?: File | null) => {
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const prepared = await prepareImage(file);
      const path = `images/${user.id}-${Date.now()}.${prepared.ext}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-media')
        .upload(path, prepared.blob, { contentType: prepared.contentType, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('listing-media').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Impossible de récupérer l'URL de l'image");
      const previous = customImageUrl;
      setCustomImageUrl(data.publicUrl);
      if (previous) void removeUploaded(previous);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Échec du téléversement'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    const title = formData.title.trim();
    const offer = formData.description_offer.trim();
    const wanted = formData.desired_exchange_desc.trim();
    const min = formData.estimation_min ? parseFloat(formData.estimation_min) : null;
    const max = formData.estimation_max ? parseFloat(formData.estimation_max) : null;

    if (title.length < 3) return setError('Le titre doit contenir au moins 3 caractères.');
    if (offer.length < 10) return setError('Décrivez votre offre en quelques mots (10 caractères minimum).');
    if ((min !== null && (Number.isNaN(min) || min < 0)) || (max !== null && (Number.isNaN(max) || max < 0))) {
      return setError('Les valeurs estimées doivent être des nombres positifs.');
    }
    if (min !== null && max !== null && min > max) return setError('La valeur minimale doit être inférieure à la valeur maximale.');

    setLoading(true);
    try {
      const moderation = await checkContent([title, offer, wanted].join('\n'), user.id);
      if (moderation.hasBlock) {
        setError(`Votre annonce contient un terme interdit (${moderation.blockWords.join(', ')}). Modifiez le texte avant de publier.`);
        return;
      }
      if (moderation.hasWarning) {
        toast.info(`Attention : termes sensibles détectés (${moderation.warningWords.join(', ')}). Restez vigilant face aux arnaques.`);
      }

      const { data: listingRows, error: insertError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          type: formData.type,
          category_id: formData.category_id || null,
          title,
          description_offer: offer,
          desired_exchange_desc: wanted,
          mode: formData.mode,
          estimation_min: min,
          estimation_max: max,
          status: 'published',
          location_lat: user.geo_lat ?? null,
          location_lng: user.geo_lng ?? null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      if (listingRows?.id && customImageUrl) {
        const { error: mediaError } = await supabase.from('listing_media').insert({
          listing_id: listingRows.id,
          url: customImageUrl,
          type: 'image',
          sort_order: 0,
        });
        if (mediaError) throw mediaError;
      }

      setFormData(EMPTY_FORM);
      setCustomImageUrl(null);
      toast.success('Annonce publiée !');
      onSuccess();
      onBack();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const modeOptions: { value: typeof formData.mode; label: string; icon: string }[] = [
    { value: 'remote', label: 'À distance', icon: 'devices' },
    { value: 'on_site', label: 'Présentiel', icon: 'person_pin_circle' },
    { value: 'both', label: 'Les deux', icon: 'dynamic_feed' },
  ];

  return (
    <div className="w-full max-w-5xl pb-24">
      <form onSubmit={handleSubmit}>
        <PageBackLink onClick={onBack} label="Retour aux annonces" />

        <div className="mb-10 md:mb-12">
          <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">Créer une annonce</h1>
          <p className="max-w-2xl font-inter text-base leading-relaxed text-on-surface-variant md:text-lg">
            Dites ce que vous proposez et ce que vous aimeriez recevoir en échange.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <section className="space-y-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg md:p-12">
              <fieldset className="space-y-4">
                <legend className={sectionLabelClass}>Type de troc</legend>
                <div className="flex max-w-sm rounded-xl bg-surface-container-low p-1" role="radiogroup" aria-label="Type de troc">
                  {(['product', 'service'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={formData.type === t}
                      onClick={() => setFormData({ ...formData, type: t })}
                      className={`min-h-11 flex-1 rounded-lg px-6 py-3 text-sm font-bold transition-all ${
                        formData.type === t ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {t === 'product' ? 'Objet' : 'Service'}
                    </button>
                  ))}
                </div>
              </fieldset>

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
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden>
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
                  minLength={3}
                  maxLength={120}
                />
              </div>
            </section>

            <section className="space-y-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg md:p-12">
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
                  minLength={10}
                  maxLength={3000}
                />
                <p className="text-right text-xs text-on-surface-variant">{formData.description_offer.length}/3000</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="create-wanted" className={sectionLabelClass}>
                    Ce que vous recherchez
                  </label>
                  <span className="rounded bg-secondary-container/40 px-2 py-1 text-xs font-bold text-on-secondary-container">Optionnel</span>
                </div>
                <textarea
                  id="create-wanted"
                  value={formData.desired_exchange_desc}
                  onChange={(e) => setFormData({ ...formData, desired_exchange_desc: e.target.value })}
                  rows={4}
                  className={fieldClass}
                  placeholder="Objets ou services que vous aimeriez recevoir en échange…"
                  maxLength={3000}
                />
              </div>
            </section>

            <section className="space-y-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg md:p-12">
              <fieldset className="space-y-4">
                <legend className={sectionLabelClass}>Mode d&apos;échange</legend>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {modeOptions.map((opt) => {
                    const active = formData.mode === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`group relative flex min-h-11 cursor-pointer flex-col rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container ${
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
                        <span className={`material-symbols-outlined mb-2 text-[28px] ${active ? 'text-primary' : 'text-outline group-hover:text-primary'}`} aria-hidden>
                          {opt.icon}
                        </span>
                        <span className="text-sm font-bold text-on-surface">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className={sectionLabelClass}>Valeur estimée (facultatif)</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <label htmlFor="create-min" className="sr-only">
                      Valeur minimale en euros
                    </label>
                    <input
                      id="create-min"
                      type="number"
                      inputMode="decimal"
                      value={formData.estimation_min}
                      onChange={(e) => setFormData({ ...formData, estimation_min: e.target.value })}
                      className={`${fieldClass} pl-10`}
                      placeholder="Min"
                      min="0"
                      max="1000000"
                      step="0.01"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant" aria-hidden>
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <label htmlFor="create-max" className="sr-only">
                      Valeur maximale en euros
                    </label>
                    <input
                      id="create-max"
                      type="number"
                      inputMode="decimal"
                      value={formData.estimation_max}
                      onChange={(e) => setFormData({ ...formData, estimation_max: e.target.value })}
                      className={`${fieldClass} pl-10`}
                      placeholder="Max"
                      min="0"
                      max="1000000"
                      step="0.01"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant" aria-hidden>
                      €
                    </span>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Indicatif : la fourchette n’apparaît pas sur la fiche publique, mais elle est reprise dans le contrat d’échange.
                </p>
              </fieldset>
            </section>

            {error ? (
              <div role="alert" className="rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
                {error}
              </div>
            ) : null}

            <div className="hidden flex-col gap-4 border-t border-outline-variant/15 pt-8 md:flex md:flex-row">
              <button
                type="button"
                onClick={onBack}
                className="min-h-12 flex-1 rounded-full border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="min-h-12 flex-[2] rounded-full bg-primary py-4 font-headline font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Publication…' : "Publier l'annonce"}
              </button>
            </div>
          </div>

          <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-28">
            <div className="space-y-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
              <span className={sectionLabelClass}>Photo de l&apos;annonce</span>
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-container-high">
                {customImageUrl ? (
                  <img src={customImageUrl} alt="Aperçu de la photo de l’annonce" className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${placeholder.gradient}`} aria-hidden>
                    <span className="material-symbols-outlined text-7xl text-primary/70">{placeholder.icon}</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-on-surface/40 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex min-h-11 items-center gap-2 rounded-full bg-surface-container-lowest px-6 py-3 font-headline text-sm font-bold text-on-surface shadow-xl"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden>
                      photo_camera
                    </span>
                    {uploading ? 'Envoi…' : customImageUrl ? 'Changer' : 'Ajouter une photo'}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  aria-label="Choisir une photo"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                  disabled={uploading}
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary min-h-11 w-full md:hidden"
              >
                {uploading ? 'Envoi…' : customImageUrl ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {customImageUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    void removeUploaded(customImageUrl);
                    setCustomImageUrl(null);
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Retirer la photo
                </button>
              ) : null}
              <div className="flex items-start gap-3 rounded-xl bg-secondary-container/40 p-4">
                <span className="material-symbols-outlined shrink-0 text-on-secondary-container" aria-hidden>
                  lightbulb
                </span>
                <p className="text-xs font-medium leading-tight text-on-secondary-container">
                  Une photo nette augmente vos chances de recevoir une proposition. JPEG, PNG ou WebP, 10 Mo max.
                </p>
              </div>
            </div>

            <div className="space-y-6 rounded-2xl bg-surface-container-low p-8">
              <h2 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">Conseils</h2>
              <ul className="space-y-4">
                {[
                  'Soyez précis sur ce que vous offrez et ce que vous attendez.',
                  'Une fourchette de valeur aide à proposer des échanges équilibrés.',
                  'Indiquez vos disponibilités ou contraintes dans la description.',
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary" aria-hidden>
                      {i + 1}
                    </span>
                    <p className="text-sm text-on-surface-variant">{text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4 pt-2 md:hidden">
              <button type="button" onClick={onBack} className="min-h-12 w-full rounded-full border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface-variant">
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="min-h-12 w-full rounded-full bg-primary py-4 font-headline font-bold text-on-primary shadow-lg shadow-primary/20 disabled:opacity-50"
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
