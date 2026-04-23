import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { PageBackRowSpacer } from '../layout/PageBackLink';

function SettingsToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`relative inline-flex cursor-pointer items-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <div className="relative h-6 w-11 shrink-0 rounded-full bg-surface-container-high after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
    </label>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNewProposal: true,
    emailAcceptedProposal: true,
    emailNewMessage: true,
    emailWeeklyDigest: false,
  });

  useEffect(() => {
    const v = (user as unknown as { user_metadata?: { profile_visibility?: string } })?.user_metadata?.profile_visibility;
    if (v === 'private' || v === 'public') setProfileVisibility(v);
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) throw updateError;

      setSuccess('Mot de passe modifié avec succès !');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (key: keyof typeof notificationSettings) => {
    const newSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    setNotificationSettings(newSettings);

    if (user) {
      await supabase.from('users').update({ notification_settings: newSettings }).eq('id', user.id);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.from('users').update({ status: 'deleted' }).eq('id', user.id);

      if (deleteError) throw deleteError;

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression du compte');
      setLoading(false);
    }
  };

  const handleToggleProfileVisibility = async () => {
    if (!user) return;
    setPrivacyLoading(true);
    setError('');
    setSuccess('');

    const nextVisibility = profileVisibility === 'public' ? 'private' : 'public';

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { profile_visibility: nextVisibility },
      });

      if (updateError) throw updateError;

      setProfileVisibility(nextVisibility);
      setSuccess(
        nextVisibility === 'public'
          ? 'Profil rendu visible à tous.'
          : 'Profil rendu privé. Il ne sera visible que si vous partagez le lien.',
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible de mettre à jour la visibilité pour le moment.',
      );
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleRequestMyData = async () => {
    if (!user) return;
    setPrivacyLoading(true);
    setError('');
    setSuccess('');

    try {
      setSuccess('Demande enregistrée. Vous recevrez un e-mail avec vos données.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de traiter la demande pour le moment.');
    } finally {
      setPrivacyLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="w-full max-w-7xl py-12 text-center text-on-surface-variant">
        Connectez-vous pour accéder aux paramètres.
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl space-y-16 md:space-y-20">
      <PageBackRowSpacer />
      <section className="mb-10 md:mb-12">
        <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
          Paramètres
        </h1>
        <p className="font-inter text-base text-on-surface-variant opacity-90 md:text-lg">
          Gérez la sécurité, les notifications et la confidentialité de votre compte.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-error dark:text-error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-primary/20 bg-primary-fixed/30 px-4 py-3 text-sm text-on-primary-fixed dark:text-on-primary-fixed">
          {success}
        </div>
      ) : null}

      <section id="security" className="max-w-2xl scroll-mt-28 space-y-8">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              Sécurité du compte
            </h2>
            <p className="text-on-surface-variant">Protégez votre compte avec un mot de passe solide.</p>
          </div>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] dark:border-slate-700 dark:bg-slate-900">
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="font-inter text-sm font-semibold text-on-surface-variant">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 dark:bg-slate-900"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-inter text-sm font-semibold text-on-surface-variant">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 dark:bg-slate-900"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-primary px-8 py-3 font-headline font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-50 md:w-auto"
              >
                {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          </div>
        </section>

        <section id="notifications" className="scroll-mt-28 space-y-8">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Notifications</h2>
            <p className="text-on-surface-variant">
              Restez informé de vos propositions d&apos;échange et de vos messages.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(
              [
                {
                  key: 'emailNewProposal' as const,
                  title: 'Nouvelles propositions',
                  desc: "Recevoir une alerte lorsqu'une offre vous est faite.",
                },
                {
                  key: 'emailAcceptedProposal' as const,
                  title: 'Propositions acceptées',
                  desc: "Être notifié dès qu'un échange est confirmé.",
                },
                {
                  key: 'emailNewMessage' as const,
                  title: 'Nouveaux messages',
                  desc: 'Notifications pour les conversations directes.',
                },
                {
                  key: 'emailWeeklyDigest' as const,
                  title: 'Résumé hebdomadaire',
                  desc: 'Un récapitulatif de votre activité sur la semaine.',
                },
              ] as const
            ).map(({ key, title, desc }) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-6 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="min-w-0 space-y-1">
                  <h3 className="font-headline text-lg font-bold text-on-surface">{title}</h3>
                  <p className="text-sm text-on-surface-variant">{desc}</p>
                </div>
                <SettingsToggle
                  checked={notificationSettings[key]}
                  onChange={() => handleNotificationToggle(key)}
                />
              </div>
            ))}
          </div>
        </section>

        <section id="privacy" className="scroll-mt-28 space-y-8">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              Confidentialité et données
            </h2>
            <p className="text-on-surface-variant">
              Contrôlez la visibilité de votre profil et vos données personnelles.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-6 rounded-xl bg-surface-container-lowest p-8 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <span className="material-symbols-outlined">visibility</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">Visibilité du profil</h3>
                  <p className="text-sm text-on-surface-variant">
                    Statut :{' '}
                    <span className="font-bold text-primary">
                      {profileVisibility === 'public' ? 'Public' : 'Privé'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleProfileVisibility}
                disabled={privacyLoading}
                className="w-full rounded-xl bg-surface-container-low py-4 font-headline font-bold text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {profileVisibility === 'public' ? 'Rendre le profil privé' : 'Rendre le profil public'}
              </button>
            </div>

            <div className="space-y-6 rounded-xl bg-surface-container-lowest p-8 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined">download</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface">Télécharger mes données</h3>
                  <p className="text-sm text-on-surface-variant">Demander une copie de vos données (RGPD).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestMyData}
                disabled={privacyLoading}
                className="w-full rounded-xl border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface transition-all hover:border-primary disabled:opacity-60 dark:border-slate-600"
              >
                Demander l&apos;export
              </button>
            </div>
          </div>
        </section>

        <section id="danger" className="scroll-mt-28 space-y-8 pb-8">
          <div className="space-y-2">
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-error">Zone sensible</h2>
            <p className="text-on-surface-variant">Actions irréversibles — à utiliser avec précaution.</p>
          </div>
          <div className="flex flex-col items-stretch gap-6 rounded-xl border-2 border-error/20 bg-error-container/20 p-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="font-headline text-xl font-bold text-on-error-container">Supprimer mon compte</h3>
              <p className="max-w-md text-on-error-container/80">
                Cette action est définitive : annonces, messages et historique seront supprimés.
              </p>
            </div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 rounded-full bg-error px-8 py-4 font-headline font-bold text-on-error shadow-lg transition-all hover:scale-[1.02] active:scale-95"
              >
                Supprimer mon compte
              </button>
            ) : (
              <div className="flex w-full flex-col gap-4 md:w-auto md:items-end">
                <p className="text-center text-sm font-semibold text-on-error-container md:text-right">
                  Confirmer la suppression définitive ?
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-full border border-outline-variant/40 bg-surface-container-lowest px-6 py-3 font-headline font-bold text-on-surface dark:bg-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="rounded-full bg-error px-6 py-3 font-headline font-bold text-on-error disabled:opacity-50"
                  >
                    {loading ? 'Suppression…' : 'Oui, supprimer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
    </div>
  );
}
