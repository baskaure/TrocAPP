import { useState, useEffect, ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Review } from '../../lib/supabase';
import { PageBackRowSpacer } from '../layout/PageBackLink';

type ReviewWithReviewer = Review & {
  reviewer?: { id: string; display_name: string; avatar_url?: string };
};

function VerificationUpload({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/verification_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('verification-documents')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('verification-documents').getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from('users')
        .update({
          verification_document_url: publicUrl,
          verification_status: 'pending',
          verification_submitted_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) throw updateError;
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Erreur lors du téléversement';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 font-headline text-sm font-bold text-on-primary transition-colors hover:opacity-95">
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
            <span>Téléversement…</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
            <span>Envoyer un document</span>
          </>
        )}
      </label>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}

function formatRelativeOrDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

type ProfilePageProps = {
  onUserClick?: (userId: string) => void;
};

export function ProfilePage({ onUserClick }: ProfilePageProps) {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [listingsCount, setListingsCount] = useState(0);
  const [mediaUploading, setMediaUploading] = useState({ avatar: false, banner: false });

  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    phone: '',
    city: '',
    country: '',
    languages: [] as string[],
    skills: [] as string[],
    search_radius_km: 50,
    avatar_url: '',
    banner_url: '',
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        username: user.username || '',
        bio: user.bio || '',
        phone: user.phone || '',
        city: user.city || '',
        country: user.country || '',
        languages: user.languages || [],
        skills: user.skills || [],
        search_radius_km: user.search_radius_km || 50,
        avatar_url: user.avatar_url || '',
        banner_url: user.banner_url || '',
      });
      loadReviews();
      loadListingsCount();
    }
  }, [user]);

  async function loadListingsCount() {
    if (!user) return;
    try {
      const { count, error: cErr } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'published');
      if (!cErr && count !== null) setListingsCount(count);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadReviews() {
    if (!user) return;
    setReviewsLoading(true);
    try {
      const { data, error: rErr } = await supabase
        .from('reviews')
        .select(
          `
          *,
          reviewer:users!reviews_reviewer_id_fkey(id, display_name, avatar_url)
        `,
        )
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });
      if (rErr) throw rErr;
      setReviews((data as ReviewWithReviewer[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setReviewsLoading(false);
    }
  }

  const uploadProfileMedia = async (file: File, type: 'avatar' | 'banner') => {
    if (!user) return;
    setMediaUploading((prev) => ({ ...prev, [type]: true }));
    setError('');
    try {
      const folder = type === 'avatar' ? 'avatars' : 'banners';
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${folder}/${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      if (!data?.publicUrl) throw new Error('Impossible de récupérer le lien de l’image');
      if (type === 'avatar') {
        setFormData((prev) => ({ ...prev, avatar_url: data.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, banner_url: data.publicUrl }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur téléversement');
    } finally {
      setMediaUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadProfileMedia(file, type);
      event.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          bio: formData.bio,
          phone: formData.phone,
          city: formData.city,
          country: formData.country,
          languages: formData.languages,
          skills: formData.skills,
          search_radius_km: formData.search_radius_km,
          avatar_url: formData.avatar_url,
          banner_url: formData.banner_url,
        })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await refreshUser();
      setSuccess('Profil mis à jour.');
      setIsEditing(false);
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const avgDisplay =
    user && user.rating_count > 0
      ? user.rating_avg.toFixed(1)
      : reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : '—';

  const showVerifiedBadge = user?.is_verified || user?.verification_status === 'verified';

  if (!user) {
    return (
      <div className="w-full py-12 text-center text-on-surface-variant">
        Veuillez vous connecter pour voir votre profil      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl">
      <PageBackRowSpacer />
      {/* Hero bannière + avatar (carte unie : plus de bande grise du body sous le chevauchement) */}
      <section className="relative overflow-hidden rounded-xl border border-outline-variant/10 shadow-xl dark:border-slate-700">
        {/* Bannière uniquement (le pseudo est dans la barre blanche en dessous) */}
        <div className="relative h-72 w-full overflow-hidden rounded-t-xl md:h-96">
          {formData.banner_url ? (
            <img src={formData.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/40 via-primary-container/30 to-surface-container-high" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          {isEditing ? (
            <label className="absolute right-4 top-4 z-10 flex cursor-pointer items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'banner')}
              />
              <span className="material-symbols-outlined text-[18px]">image</span>
              {mediaUploading.banner ? '…' : 'Bannière'}
            </label>
          ) : null}
        </div>

        {/* Bandeau sous la bannière : avatar remonte sur la bannière, pseudo + bouton restent ici */}
        <div className="relative z-10 rounded-b-xl bg-surface-container-lowest px-4 pb-8 pt-6 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] dark:bg-slate-900 md:px-8 md:pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
            <div className="relative z-20 w-fit shrink-0 -mt-20 self-start md:-mt-24">
              <div className="h-32 w-32 overflow-hidden rounded-full border-8 border-surface-container-lowest shadow-2xl dark:border-slate-900 md:h-44 md:w-44">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary-container font-headline text-4xl font-black text-on-secondary-container md:text-5xl">
                    {formData.display_name[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              {showVerifiedBadge ? (
                <div className="absolute bottom-2 right-2 rounded-full bg-secondary-container p-2 shadow-lg">
                  <span
                    className="material-symbols-outlined text-xl text-on-secondary-container"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
              ) : null}
              {isEditing ? (
                <label className="absolute bottom-12 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-lg md:bottom-14">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, 'avatar')}
                  />
                  <span className="material-symbols-outlined text-[20px]">
                    {mediaUploading.avatar ? 'hourglass_empty' : 'photo_camera'}
                  </span>
                </label>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between md:pb-1">
              <div>
                <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl dark:text-slate-100">
                  {formData.display_name}
                </h1>
                <p className="text-base font-medium text-primary md:text-lg">@{formData.username}</p>
                {!isEditing && formData.bio ? (
                  <p className="mt-2 max-w-xl text-sm text-on-surface-variant">{formData.bio}</p>
                ) : null}
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="glass-card flex w-fit shrink-0 items-center gap-2 rounded-full border border-outline-variant/20 bg-white px-8 py-3 font-headline font-bold text-primary shadow-sm transition-all hover:bg-surface-container-low active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <span className="material-symbols-outlined">edit</span>
                  Modifier
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="w-fit rounded-full border border-outline-variant/30 bg-surface-container-high px-6 py-3 font-headline font-bold transition-colors hover:bg-surface-container-highest"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-xl border border-error-container bg-error-container/20 p-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          {success}
        </div>
      ) : null}

      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          className="glass-card mt-10 space-y-6 rounded-xl border border-white/40 p-6 dark:border-white/10 md:p-8"
        >
          <h2 className="font-headline text-xl font-bold">Modifier le profil</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nom d&apos;affichage</label>
              <input
                required
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nom d&apos;utilisateur</label>
              <input
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ville</label>
              <input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pays</label>
              <input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rayon (km)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={formData.search_radius_km}
                onChange={(e) =>
                  setFormData({ ...formData, search_radius_km: parseInt(e.target.value, 10) || 50 })
                }
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 dark:bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Langues</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.languages.map((lang) => (
                <span                  key={lang}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-fixed/30 px-3 py-1 text-sm font-semibold"
                >
                  {lang}
                  <button
                    type="button"
                    className="text-primary"
                    onClick={() =>
                      setFormData({ ...formData, languages: formData.languages.filter((l) => l !== lang) })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Ajouter"
                className="flex-1 rounded-xl border border-outline-variant/30 px-3 py-2 dark:bg-slate-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLanguage.trim()) {
                    e.preventDefault();
                    const v = newLanguage.trim();
                    if (!formData.languages.includes(v)) {
                      setFormData({ ...formData, languages: [...formData.languages, v] });
                    }
                    setNewLanguage('');
                  }
                }}
              />
              <button
                type="button"
                className="rounded-full bg-surface-container-high px-4 py-2 text-sm font-bold dark:bg-slate-700"
                onClick={() => {
                  const v = newLanguage.trim();
                  if (v && !formData.languages.includes(v)) {
                    setFormData({ ...formData, languages: [...formData.languages, v] });
                    setNewLanguage('');
                  }
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Compétences</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary-container/40 px-3 py-1 text-sm font-bold text-on-secondary-container"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Ajouter"
                className="flex-1 rounded-xl border border-outline-variant/30 px-3 py-2 dark:bg-slate-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSkill.trim()) {
                    e.preventDefault();
                    const v = newSkill.trim();
                    if (!formData.skills.includes(v)) {
                      setFormData({ ...formData, skills: [...formData.skills, v] });
                    }
                    setNewSkill('');
                  }
                }}
              />
              <button
                type="button"
                className="rounded-full bg-surface-container-high px-4 py-2 text-sm font-bold dark:bg-slate-700"
                onClick={() => {
                  const v = newSkill.trim();
                  if (v && !formData.skills.includes(v)) {
                    setFormData({ ...formData, skills: [...formData.skills, v] });
                    setNewSkill('');
                  }
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Biographie</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-outline-variant/30 px-3 py-2 dark:bg-slate-900"
              placeholder="Parlez-nous de vous…"
            />
          </div>

          <div className="rounded-xl border border-dashed border-outline-variant/40 p-4">
            <p className="mb-3 text-sm font-medium">Photos</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-slate-900">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'avatar')} />
                <span className="material-symbols-outlined mb-1 text-primary">face</span>
                <span className="text-sm font-semibold">{mediaUploading.avatar ? '…' : 'Avatar'}</span>
              </label>
              <label className="flex cursor-pointer flex-col items-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-slate-900">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'banner')} />
                <span className="material-symbols-outlined mb-1 text-primary">panorama</span>
                <span className="text-sm font-semibold">{mediaUploading.banner ? '…' : 'Bannière'}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-headline font-bold text-on-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-24 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <aside className="space-y-8 lg:col-span-4">
            {showVerifiedBadge ? (
              <div className="flex items-center gap-4 rounded-xl border border-primary-fixed/30 bg-primary-fixed-dim/20 p-6 dark:bg-primary/10">
                <div className="rounded-full bg-primary p-3 text-on-primary">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div>
                  <p className="font-headline font-bold text-on-surface">Profil vérifié</p>
                  <p className="text-sm text-on-surface-variant">Votre identité a été confirmée</p>
                </div>
              </div>
            ) : user.verification_status === 'pending' ? (
              <div className="rounded-xl border border-secondary-container/40 bg-secondary-container/15 p-6">
                <p className="font-headline font-bold text-on-surface">Vérification en cours</p>
                <p className="mt-1 text-sm text-on-surface-variant">Document en examen.</p>
              </div>
            ) : user.verification_status === 'rejected' ? (
              <div className="rounded-xl border border-error-container/40 bg-error-container/15 p-6">
                <p className="font-headline font-bold text-on-error-container">Vérification refusée</p>
                <VerificationUpload onSuccess={refreshUser} />
              </div>
            ) : (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6">
                <p className="mb-3 text-sm text-on-surface-variant">
                  Vérifiez votre profil pour renforcer la confiance.
                </p>
                <VerificationUpload onSuccess={refreshUser} />
              </div>
            )}

            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <h3 className="mb-6 font-headline text-xl font-bold text-on-surface">Infos</h3>
              <ul className="space-y-6">
                <li className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">mail</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Email</p>
                    <p className="font-medium text-on-surface">{user.email}</p>
                  </div>
                </li>
                {(formData.city || formData.country) && (
                  <li className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">location_on</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-outline">Localisation</p>
                      <p className="font-medium text-on-surface">
                        {[formData.city, formData.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </li>
                )}
                {formData.phone ? (
                  <li className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">call</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-outline">Téléphone</p>
                      <p className="font-medium text-on-surface">{formData.phone}</p>
                    </div>
                  </li>
                ) : null}
                <li className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">calendar_month</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-outline">Membre depuis</p>
                    <p className="font-medium text-on-surface">{formatDate(user.created_at)}</p>
                  </div>
                </li>
              </ul>

              <div className="mt-8 border-t border-surface-container pt-8">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-outline">Langues</p>
                <div className="flex flex-wrap gap-2">
                  {formData.languages.length ? (
                    formData.languages.map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface-variant dark:bg-slate-800"
                      >
                        {lang}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-on-surface-variant">—</span>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-outline">Compétences</p>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.length ? (
                    formData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container shadow-sm"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-on-surface-variant">—</span>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="group rounded-xl border border-outline-variant/10 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 font-headline text-4xl font-black text-primary">{listingsCount}</p>
                <p className="text-sm font-bold uppercase tracking-widest text-outline transition-colors group-hover:text-primary">
                  Annonces
                </p>
              </div>
              <div className="group rounded-xl border border-outline-variant/10 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 font-headline text-4xl font-black text-primary">{reviews.length}</p>
                <p className="text-sm font-bold uppercase tracking-widest text-outline transition-colors group-hover:text-primary">
                  Avis reçus
                </p>
              </div>
              <div className="group rounded-xl bg-secondary-container p-6 text-center shadow-sm transition-transform hover:scale-[1.02]">
                <p className="mb-1 font-headline text-4xl font-black text-on-secondary-container">
                  {avgDisplay}
                </p>
                <p className="text-sm font-bold uppercase tracking-widest text-on-secondary-container">
                  Note moyenne
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-low p-8 dark:bg-slate-800/50">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface dark:text-white">
                  Avis reçus ({reviews.length})
                </h2>
                <div className="flex gap-0.5 text-secondary-container">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const v = parseFloat(avgDisplay === '—' ? '0' : avgDisplay);
                    const filled = v >= s - 0.25;
                    return (
                      <span
                        key={s}
                        className="material-symbols-outlined text-2xl"
                        style={
                          filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined
                        }
                      >
                        star
                      </span>
                    );
                  })}
                </div>
              </div>

              {reviewsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="py-12 text-center text-on-surface-variant">Aucun avis pour le moment</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-lg border border-outline-variant/5 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-primary/20 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <button
                          type="button"
                          className={`flex items-center gap-4 text-left ${onUserClick && review.reviewer?.id ? 'cursor-pointer rounded-xl hover:opacity-90' : ''}`}
                          onClick={() => review.reviewer?.id && onUserClick?.(review.reviewer.id)}
                          disabled={!onUserClick || !review.reviewer?.id}
                        >
                          <div className="h-12 w-12 overflow-hidden rounded-full">
                            {review.reviewer?.avatar_url ? (
                              <img
                                src={review.reviewer.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-secondary-container/30 font-bold text-on-secondary-container">
                                {review.reviewer?.display_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface dark:text-white">
                              {review.reviewer?.display_name ?? '—'}
                            </p>
                            <p className="text-xs text-outline">{formatRelativeOrDate(review.created_at)}</p>
                          </div>
                        </button>
                        <div className="flex shrink-0 text-secondary-container">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className="material-symbols-outlined text-lg"
                              style={
                                star <= review.rating
                                  ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                                  : undefined
                              }
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                      {review.comment ? (
                        <p className="mb-4 italic text-on-surface-variant">&quot;{review.comment}&quot;</p>
                      ) : null}
                      {review.tags && review.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {review.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold uppercase tracking-tighter text-on-primary-fixed-variant dark:bg-primary/25 dark:text-primary-fixed"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
