import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, errorMessage, type Review, type User } from '../../lib/supabase';
import { PageBackRowSpacer } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, prepareImage, storagePathFromPublicUrl } from '../../lib/image';
import { USERNAME_RE, formatDateFr, normalizeUsername } from '../../lib/labels';
import { checkContent } from '../../lib/moderation';

const VERIFICATION_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

function VerificationUpload({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowed.includes(file.type)) throw new Error('Formats acceptés : JPEG, PNG, WebP ou PDF.');
      if (file.size > IMAGE_MAX_BYTES) throw new Error('Fichier trop lourd (10 Mo maximum).');
      const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/verification_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('verification-documents').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      // On efface l'ancien document s'il existe encore.
      const previous = user.verification_document_url;
      if (previous) {
        const oldPath = previous.startsWith('http') ? decodeURIComponent(previous.split('/verification-documents/')[1] ?? '') : previous;
        if (oldPath && oldPath !== path) await supabase.storage.from('verification-documents').remove([oldPath]);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ verification_document_url: path, verification_status: 'pending', verification_submitted_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      onSuccess();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Erreur lors du téléversement'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 font-headline text-sm font-bold text-on-primary transition-colors hover:opacity-95">
        <input type="file" accept={VERIFICATION_ACCEPT} className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" aria-hidden />
            <span>Téléversement…</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              verified_user
            </span>
            <span>Envoyer une pièce d’identité</span>
          </>
        )}
      </label>
      <p className="mt-2 text-xs text-on-surface-variant">Document privé, consulté uniquement par notre équipe puis supprimé après examen.</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatRelativeOrDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return formatDateFr(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

type ProfilePageProps = {
  onUserClick?: (userId: string) => void;
};

type FormState = {
  display_name: string;
  username: string;
  bio: string;
  phone: string;
  city: string;
  country: string;
  languages: string[];
  skills: string[];
  avatar_url: string;
  banner_url: string;
};

function formFromUser(user: User): FormState {
  return {
    display_name: user.display_name || '',
    username: user.username || '',
    bio: user.bio || '',
    phone: user.phone || '',
    city: user.city || '',
    country: user.country || '',
    languages: user.languages || [],
    skills: user.skills || [],
    avatar_url: user.avatar_url || '',
    banner_url: user.banner_url || '',
  };
}

const inputClass = 'w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-on-surface';

export function ProfilePage({ onUserClick }: ProfilePageProps) {
  const { user, refreshUser } = useAuth();
  const { toast } = useNotice();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [listingsCount, setListingsCount] = useState(0);
  const [mediaUploading, setMediaUploading] = useState({ avatar: false, banner: false });
  const [formData, setFormData] = useState<FormState>(() => (user ? formFromUser(user) : formFromUser({} as User)));
  const [pendingUploads, setPendingUploads] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const userId = user?.id;
  const userUpdatedAt = user?.updated_at;

  // Hydratation uniquement hors édition : un rafraîchissement de session ne vide plus le formulaire.
  useEffect(() => {
    if (user && !isEditing) setFormData(formFromUser(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userUpdatedAt, isEditing]);

  const loadListingsCount = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'published');
    if (count !== null) setListingsCount(count);
  }, [userId]);

  const loadReviews = useCallback(async () => {
    if (!userId) return;
    setReviewsLoading(true);
    try {
      const { data, error: rErr } = await supabase
        .from('reviews')
        .select(`*, reviewer:public_profiles!reviews_reviewer_id_fkey(id, display_name, avatar_url)`)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (rErr) throw rErr;
      setReviews((data as unknown as Review[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setReviewsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadReviews();
    void loadListingsCount();
  }, [loadReviews, loadListingsCount]);

  const uploadProfileMedia = async (file: File, type: 'avatar' | 'banner') => {
    if (!user) return;
    setMediaUploading((prev) => ({ ...prev, [type]: true }));
    setError('');
    try {
      const prepared = await prepareImage(file, type === 'avatar' ? 512 : 1600, 0.85);
      const folder = type === 'avatar' ? 'avatars' : 'banners';
      const path = `${folder}/${user.id}-${Date.now()}.${prepared.ext}`;
      const { error: uploadError } = await supabase.storage.from('profile-media').upload(path, prepared.blob, { contentType: prepared.contentType, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Impossible de récupérer le lien de l’image');
      setPendingUploads((prev) => [...prev, data.publicUrl]);
      setFormData((prev) => ({ ...prev, [type === 'avatar' ? 'avatar_url' : 'banner_url']: data.publicUrl }));
    } catch (err) {
      setError(errorMessage(err, 'Erreur de téléversement'));
    } finally {
      setMediaUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = event.target.files?.[0];
    if (file) void uploadProfileMedia(file, type);
    event.target.value = '';
  };

  const removeObjects = async (urls: string[]) => {
    const paths = urls.map((u) => storagePathFromPublicUrl(u, 'profile-media')).filter((p): p is string => Boolean(p));
    if (paths.length) await supabase.storage.from('profile-media').remove(paths);
  };

  const handleCancelEdit = () => {
    if (!user) return;
    const kept = new Set([user.avatar_url, user.banner_url]);
    void removeObjects(pendingUploads.filter((u) => !kept.has(u)));
    setPendingUploads([]);
    setFormData(formFromUser(user));
    setIsEditing(false);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    const username = normalizeUsername(formData.username);
    const displayName = formData.display_name.trim();
    if (displayName.length < 2) return setError('Le nom d’affichage doit contenir au moins 2 caractères.');
    if (!USERNAME_RE.test(username)) return setError('Le nom d’utilisateur doit contenir entre 3 et 30 caractères : lettres minuscules, chiffres et _.');
    setLoading(true);
    try {
      const moderation = await checkContent([displayName, username, formData.bio].join('\n'), user.id);
      if (moderation.hasBlock) {
        setError(`Le profil contient un terme interdit (${moderation.blockWords.join(', ')}).`);
        return;
      }
      if (username !== user.username) {
        const { data: taken } = await supabase.from('public_profiles').select('id').eq('username', username).neq('id', user.id).limit(1);
        if (taken && taken.length > 0) {
          setError('Ce nom d’utilisateur est déjà pris.');
          return;
        }
      }
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: displayName.slice(0, 60),
          username,
          bio: formData.bio.trim().slice(0, 800) || null,
          phone: formData.phone.trim().slice(0, 30) || null,
          city: formData.city.trim().slice(0, 80) || null,
          country: formData.country.trim().slice(0, 80) || null,
          languages: formData.languages.slice(0, 10),
          skills: formData.skills.slice(0, 15),
          avatar_url: formData.avatar_url || null,
          banner_url: formData.banner_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      // Nettoyage : anciens visuels remplacés et téléversements non retenus.
      const keep = new Set([formData.avatar_url, formData.banner_url]);
      const toRemove = [...pendingUploads.filter((u) => !keep.has(u)), user.avatar_url, user.banner_url].filter((u): u is string => Boolean(u) && !keep.has(u as string));
      void removeObjects(toRemove);
      setPendingUploads([]);

      await refreshUser();
      toast.success('Profil mis à jour.');
      setIsEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de la mise à jour'));
    } finally {
      setLoading(false);
    }
  };

  const addTag = (kind: 'languages' | 'skills', raw: string) => {
    const v = raw.trim().slice(0, 30);
    if (!v) return;
    setFormData((prev) => (prev[kind].includes(v) || prev[kind].length >= (kind === 'languages' ? 10 : 15) ? prev : { ...prev, [kind]: [...prev[kind], v] }));
    if (kind === 'languages') setNewLanguage('');
    else setNewSkill('');
  };

  if (!user) return null;

  const rating = Number(user.rating_avg ?? 0);
  const ratingCount = user.rating_count ?? 0;
  const avgDisplay = ratingCount > 0 ? rating.toFixed(1) : '—';
  const showVerifiedBadge = user.is_verified || user.verification_status === 'verified';
  const displayAvatar = isEditing ? formData.avatar_url : user.avatar_url;
  const displayBanner = isEditing ? formData.banner_url : user.banner_url;

  return (
    <div className="w-full max-w-5xl">
      <PageBackRowSpacer />
      <section className="relative overflow-hidden rounded-xl border border-outline-variant/10 shadow-xl">
        <div className="relative h-72 w-full overflow-hidden rounded-t-xl md:h-96">
          {displayBanner ? <img src={displayBanner} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary/40 via-primary-container/30 to-surface-container-high" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          {isEditing ? (
            <label className="absolute right-4 top-4 z-10 flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
              <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => handleFileChange(e, 'banner')} disabled={mediaUploading.banner} />
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                image
              </span>
              {mediaUploading.banner ? 'Envoi…' : 'Changer la bannière'}
            </label>
          ) : null}
        </div>

        <div className="relative z-10 rounded-b-xl bg-surface-container-lowest px-4 pb-8 pt-6 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] md:px-8 md:pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
            <div className="relative z-20 w-fit shrink-0 -mt-20 self-start md:-mt-24">
              <div className="h-32 w-32 overflow-hidden rounded-full border-8 border-surface-container-lowest shadow-2xl md:h-44 md:w-44">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary-container font-headline text-4xl font-black text-on-secondary-container md:text-5xl" aria-hidden>
                    {(isEditing ? formData.display_name : user.display_name)[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              {showVerifiedBadge ? (
                <div className="absolute bottom-2 right-2 rounded-full bg-secondary-container p-2 shadow-lg" title="Identité vérifiée">
                  <span className="material-symbols-outlined text-xl text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }} aria-label="Identité vérifiée">
                    verified
                  </span>
                </div>
              ) : null}
              {isEditing ? (
                <label className="absolute bottom-12 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-lg md:bottom-14" title="Changer l’avatar">
                  <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => handleFileChange(e, 'avatar')} disabled={mediaUploading.avatar} />
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>
                    {mediaUploading.avatar ? 'hourglass_empty' : 'photo_camera'}
                  </span>
                  <span className="sr-only">Changer l’avatar</span>
                </label>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between md:pb-1">
              <div className="min-w-0">
                <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">{user.display_name}</h1>
                <p className="text-base font-medium text-primary md:text-lg">@{user.username}</p>
                {!isEditing && user.bio ? <p className="mt-2 max-w-xl whitespace-pre-line text-sm text-on-surface-variant">{user.bio}</p> : null}
              </div>
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className="glass-card flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-8 py-3 font-headline font-bold text-primary shadow-sm transition-all hover:bg-surface-container-low active:scale-95">
                  <span className="material-symbols-outlined" aria-hidden>
                    edit
                  </span>
                  Modifier
                </button>
              ) : (
                <button type="button" onClick={handleCancelEdit} className="min-h-11 w-fit rounded-full border border-outline-variant/30 bg-surface-container-high px-6 py-3 font-headline font-bold transition-colors hover:bg-surface-container-highest">
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="mt-6 rounded-xl border border-error-container bg-error-container/20 p-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="glass-card mt-10 space-y-6 rounded-xl border border-white/40 p-6 md:p-8">
          <h2 className="font-headline text-xl font-bold">Modifier le profil</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="pf-name" className="mb-1 block text-sm font-medium">
                Nom d&apos;affichage
              </label>
              <input id="pf-name" required minLength={2} maxLength={60} value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pf-username" className="mb-1 block text-sm font-medium">
                Nom d&apos;utilisateur
              </label>
              <input id="pf-username" required minLength={3} maxLength={30} value={formData.username} onChange={(e) => setFormData({ ...formData, username: normalizeUsername(e.target.value) })} className={inputClass} aria-describedby="pf-username-hint" />
              <p id="pf-username-hint" className="mt-1 text-xs text-on-surface-variant">
                3 à 30 caractères : lettres minuscules, chiffres et _.
              </p>
            </div>
            <div>
              <label htmlFor="pf-city" className="mb-1 block text-sm font-medium">
                Ville
              </label>
              <input id="pf-city" maxLength={80} value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pf-country" className="mb-1 block text-sm font-medium">
                Pays
              </label>
              <input id="pf-country" maxLength={80} value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pf-phone" className="mb-1 block text-sm font-medium">
                Téléphone <span className="font-normal text-on-surface-variant">(jamais affiché publiquement)</span>
              </label>
              <input id="pf-phone" type="tel" maxLength={30} autoComplete="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
            </div>
          </div>

          {(['languages', 'skills'] as const).map((kind) => {
            const label = kind === 'languages' ? 'Langues' : 'Compétences';
            const value = kind === 'languages' ? newLanguage : newSkill;
            const setValue = kind === 'languages' ? setNewLanguage : setNewSkill;
            return (
              <div key={kind}>
                <label htmlFor={`pf-${kind}`} className="mb-1 block text-sm font-medium">
                  {label}
                </label>
                <ul className="mb-2 flex flex-wrap gap-2">
                  {formData[kind].map((item) => (
                    <li key={item} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${kind === 'languages' ? 'bg-primary-fixed/30' : 'bg-secondary-container/40 text-on-secondary-container'}`}>
                      {item}
                      <button type="button" className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-on-surface/10" aria-label={`Retirer ${item}`} onClick={() => setFormData({ ...formData, [kind]: formData[kind].filter((x) => x !== item) })}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    id={`pf-${kind}`}
                    value={value}
                    maxLength={30}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Ajouter"
                    className="flex-1 rounded-xl border border-outline-variant/30 px-3 py-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(kind, value);
                      }
                    }}
                  />
                  <button type="button" className="min-h-11 rounded-full bg-surface-container-high px-4 py-2 text-sm font-bold" onClick={() => addTag(kind, value)}>
                    Ajouter
                  </button>
                </div>
              </div>
            );
          })}

          <div>
            <label htmlFor="pf-bio" className="mb-1 block text-sm font-medium">
              Biographie
            </label>
            <textarea id="pf-bio" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={4} maxLength={800} className="w-full rounded-xl border border-outline-variant/30 px-3 py-2" placeholder="Parlez-nous de vous…" />
            <p className="mt-1 text-right text-xs text-on-surface-variant">{formData.bio.length}/800</p>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleCancelEdit} className="btn-secondary min-h-11 px-6">
              Annuler
            </button>
            <button type="submit" disabled={loading || mediaUploading.avatar || mediaUploading.banner} className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-8 py-3 font-headline font-bold text-on-primary disabled:opacity-50">
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                check
              </span>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-24 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <aside className="space-y-8 lg:col-span-4">
            {showVerifiedBadge ? (
              <div className="flex items-center gap-4 rounded-xl border border-primary-fixed/30 bg-primary-fixed-dim/20 p-6">
                <div className="rounded-full bg-primary p-3 text-on-primary">
                  <span className="material-symbols-outlined" aria-hidden>
                    verified_user
                  </span>
                </div>
                <div>
                  <p className="font-headline font-bold text-on-surface">Identité vérifiée</p>
                  <p className="text-sm text-on-surface-variant">Le badge apparaît sur votre profil et vos annonces.</p>
                </div>
              </div>
            ) : user.verification_status === 'pending' ? (
              <div className="rounded-xl border border-secondary-container/40 bg-secondary-container/15 p-6">
                <p className="font-headline font-bold text-on-surface">Vérification en cours</p>
                <p className="mt-1 text-sm text-on-surface-variant">Votre document est en cours d’examen par notre équipe.</p>
              </div>
            ) : user.verification_status === 'rejected' ? (
              <div className="space-y-3 rounded-xl border border-error-container/40 bg-error-container/15 p-6">
                <p className="font-headline font-bold text-on-error-container">Vérification refusée</p>
                {user.verification_notes ? <p className="text-sm text-on-error-container">Motif : {user.verification_notes}</p> : null}
                <VerificationUpload onSuccess={refreshUser} />
              </div>
            ) : (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6">
                <p className="mb-3 text-sm text-on-surface-variant">Faites vérifier votre identité pour obtenir le badge « vérifié » et renforcer la confiance.</p>
                <VerificationUpload onSuccess={refreshUser} />
              </div>
            )}

            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
              <h2 className="mb-6 font-headline text-xl font-bold text-on-surface">Infos</h2>
              <ul className="space-y-6">
                <li className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary" aria-hidden>
                    mail
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">E-mail (privé)</p>
                    <p className="break-all font-medium text-on-surface">{user.email}</p>
                  </div>
                </li>
                {user.city || user.country ? (
                  <li className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary" aria-hidden>
                      location_on
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-outline">Localisation</p>
                      <p className="font-medium text-on-surface">{[user.city, user.country].filter(Boolean).join(', ')}</p>
                    </div>
                  </li>
                ) : null}
                {user.phone ? (
                  <li className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary" aria-hidden>
                      call
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-outline">Téléphone (privé)</p>
                      <p className="font-medium text-on-surface">{user.phone}</p>
                    </div>
                  </li>
                ) : null}
                <li className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary" aria-hidden>
                    calendar_month
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Membre depuis</p>
                    <p className="font-medium text-on-surface">{formatDateFr(user.created_at)}</p>
                  </div>
                </li>
              </ul>

              <div className="mt-8 border-t border-surface-container pt-8">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-outline">Langues</p>
                <div className="flex flex-wrap gap-2">
                  {user.languages?.length ? user.languages.map((lang) => <span key={lang} className="rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface-variant">{lang}</span>) : <span className="text-sm text-on-surface-variant">—</span>}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-outline">Compétences</p>
                <div className="flex flex-wrap gap-2">
                  {user.skills?.length ? user.skills.map((skill) => <span key={skill} className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container shadow-sm">{skill}</span>) : <span className="text-sm text-on-surface-variant">—</span>}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-8">
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 text-center shadow-sm">
                <dd className="mb-1 font-headline text-4xl font-black text-primary">{listingsCount}</dd>
                <dt className="text-sm font-bold uppercase tracking-widest text-outline">Annonces</dt>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 text-center shadow-sm">
                <dd className="mb-1 font-headline text-4xl font-black text-primary">{ratingCount}</dd>
                <dt className="text-sm font-bold uppercase tracking-widest text-outline">Avis reçus</dt>
              </div>
              <div className="rounded-xl bg-secondary-container p-6 text-center shadow-sm">
                <dd className="mb-1 font-headline text-4xl font-black text-on-secondary-container">{avgDisplay}</dd>
                <dt className="text-sm font-bold uppercase tracking-widest text-on-secondary-container">Note moyenne</dt>
              </div>
            </dl>

            <section className="rounded-xl bg-surface-container-low p-8" aria-labelledby="my-reviews-title">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <h2 id="my-reviews-title" className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                  Avis reçus ({reviews.length})
                </h2>
                <div className="flex gap-0.5 text-secondary-container" aria-hidden>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="material-symbols-outlined text-2xl" style={rating >= s - 0.25 ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>
                      star
                    </span>
                  ))}
                </div>
              </div>

              {reviewsLoading ? (
                <div className="flex justify-center py-12" role="status" aria-label="Chargement">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="py-12 text-center text-on-surface-variant">Aucun avis pour le moment</p>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((review) => {
                    const reviewerId = review.reviewer?.id;
                    const clickable = Boolean(onUserClick && reviewerId);
                    return (
                      <li key={review.id} className="rounded-lg border border-outline-variant/5 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-primary/20">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <button type="button" className={`flex items-center gap-4 text-left ${clickable ? 'cursor-pointer rounded-xl hover:opacity-90' : 'cursor-default'}`} onClick={() => reviewerId && onUserClick?.(reviewerId)} disabled={!clickable}>
                            <div className="h-12 w-12 overflow-hidden rounded-full">
                              {review.reviewer?.avatar_url ? (
                                <img src={review.reviewer.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-secondary-container/30 font-bold text-on-secondary-container" aria-hidden>
                                  {review.reviewer?.display_name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{review.reviewer?.display_name ?? 'Membre'}</p>
                              <p className="text-xs text-outline">{formatRelativeOrDate(review.created_at)}</p>
                            </div>
                          </button>
                          <div className="flex shrink-0 text-secondary-container" aria-label={`${review.rating} sur 5`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className="material-symbols-outlined text-lg" style={star <= review.rating ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined} aria-hidden>
                                star
                              </span>
                            ))}
                          </div>
                        </div>
                        {review.comment ? <p className="mb-4 whitespace-pre-line italic text-on-surface-variant">« {review.comment} »</p> : null}
                        {review.tags && review.tags.length > 0 ? (
                          <ul className="flex flex-wrap gap-2">
                            {review.tags.map((tag) => (
                              <li key={tag} className="rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold uppercase tracking-tighter text-on-primary-fixed-variant">
                                {tag}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
