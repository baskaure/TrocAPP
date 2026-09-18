import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase, errorMessage, DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '../../lib/supabase';
import { PageBackRowSpacer } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import type { LegalSection } from '../../lib/router';

type SettingsPageProps = {
  onLegal?: (section: LegalSection) => void;
};

function SettingsToggle({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`relative inline-flex cursor-pointer items-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <input id={id} type="checkbox" role="switch" aria-checked={checked} className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <div className="relative h-6 w-11 shrink-0 rounded-full bg-surface-container-high after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
    </label>
  );
}

const NOTIFICATION_ITEMS: { key: keyof NotificationSettings; title: string; desc: string }[] = [
  { key: 'email_new_proposal', title: 'Nouvelles propositions', desc: 'Quand un membre vous fait une proposition ou une contre-proposition.' },
  { key: 'email_accepted_proposal', title: 'Contrat prêt', desc: 'Quand une proposition est acceptée et que le contrat attend votre signature.' },
  { key: 'email_new_message', title: 'Nouveaux messages', desc: 'Au plus un e-mail par conversation et par quart d’heure.' },
  { key: 'email_review_request', title: 'Rappels d’avis', desc: 'Après un échange terminé, pour penser à noter votre partenaire.' },
  { key: 'email_exchange_reminder', title: 'Rappels d’échange', desc: 'Si un échange reste sans suite pendant plusieurs jours.' },
];

const inputClass = 'w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40';

export function SettingsPage({ onLegal }: SettingsPageProps) {
  const { user, refreshUser, deleteAccount, updateProfile } = useAuth();
  const { toast, confirm } = useNotice();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    if (!user) return;
    setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(user.notification_settings ?? {}) });
  }, [user]);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) return setError('Les mots de passe ne correspondent pas.');
    if (passwordData.newPassword.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (updateError) throw updateError;
      toast.success('Mot de passe modifié.');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors du changement de mot de passe'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    const email = newEmail.trim();
    if (!email || email === user.email) return;
    setEmailLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/parametres` });
      if (updateError) throw updateError;
      toast.info(`Un lien de confirmation a été envoyé à ${email}. L’adresse changera après validation.`);
      setNewEmail('');
    } catch (err) {
      setError(errorMessage(err, 'Impossible de changer l’adresse e-mail'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleNotificationToggle = async (key: keyof NotificationSettings) => {
    if (!user) return;
    const next = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(next);
    const { error: updateError } = await supabase.from('users').update({ notification_settings: next }).eq('id', user.id);
    if (updateError) {
      setNotificationSettings(notificationSettings);
      toast.error('Préférence non enregistrée. Réessayez.');
    } else {
      void refreshUser();
    }
  };

  const handleToggleProfileVisibility = async () => {
    if (!user) return;
    setPrivacyLoading(true);
    setError('');
    const next = (user.profile_visibility ?? 'public') === 'public' ? 'private' : 'public';
    try {
      await updateProfile({ profile_visibility: next });
      toast.success(next === 'public' ? 'Profil public.' : 'Profil privé : votre bio, vos langues et vos compétences sont masquées.');
    } catch (err) {
      setError(errorMessage(err, 'Impossible de mettre à jour la visibilité.'));
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExportLoading(true);
    setError('');
    try {
      const [listings, proposalsSent, proposalsReceived, reviewsReceived, reviewsGiven, messages, exchanges] = await Promise.all([
        supabase.from('listings').select('*, media:listing_media(url, type)').eq('user_id', user.id),
        supabase.from('proposals').select('*').eq('from_user_id', user.id),
        supabase.from('proposals').select('*').eq('to_user_id', user.id),
        supabase.from('reviews').select('*').eq('reviewee_id', user.id),
        supabase.from('reviews').select('*').eq('reviewer_id', user.id),
        supabase.from('chat_messages').select('id, chat_id, body, created_at').eq('sender_id', user.id),
        supabase.from('exchanges').select('*, contract:contracts(id, status, created_at, accepted_by_from_at, accepted_by_to_at, proposal_id)'),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        profile: user,
        listings: listings.data ?? [],
        proposals: { sent: proposalsSent.data ?? [], received: proposalsReceived.data ?? [] },
        reviews: { received: reviewsReceived.data ?? [], given: reviewsGiven.data ?? [] },
        messages: messages.data ?? [],
        exchanges: exchanges.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bontroc-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    } catch (err) {
      setError(errorMessage(err, 'Export impossible pour le moment.'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER') return setError('Tapez SUPPRIMER pour confirmer.');
    const ok = await confirm({
      title: 'Supprimer définitivement votre compte ?',
      description: 'Vos annonces seront retirées, vos propositions annulées et votre profil anonymisé. Cette action est irréversible.',
      confirmLabel: 'Supprimer mon compte',
      danger: true,
    });
    if (!ok) return;
    setDeleteLoading(true);
    setError('');
    try {
      await deleteAccount();
      window.location.href = '/';
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de la suppression du compte'));
      setDeleteLoading(false);
    }
  };

  if (!user) return null;

  const visibility = user.profile_visibility ?? 'public';

  return (
    <div className="w-full max-w-5xl space-y-16 md:space-y-20">
      <PageBackRowSpacer />
      <section className="mb-10 md:mb-12">
        <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">Paramètres</h1>
        <p className="font-inter text-base text-on-surface-variant opacity-90 md:text-lg">Sécurité, notifications, confidentialité et données de votre compte.</p>
      </section>

      {error ? (
        <div role="alert" className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section id="security" aria-labelledby="security-title" className="max-w-2xl scroll-mt-28 space-y-8">
        <div className="space-y-2">
          <h2 id="security-title" className="font-headline text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
            Sécurité du compte
          </h2>
          <p className="text-on-surface-variant">Adresse de connexion : {user.email}</p>
        </div>
        <div className="space-y-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg">
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <h3 className="font-headline text-base font-bold text-on-surface">Changer de mot de passe</h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="settings-new-password" className="font-inter text-sm font-semibold text-on-surface-variant">
                  Nouveau mot de passe
                </label>
                <input id="settings-new-password" type="password" autoComplete="new-password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className={inputClass} placeholder="••••••••" required minLength={8} maxLength={72} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="settings-confirm-password" className="font-inter text-sm font-semibold text-on-surface-variant">
                  Confirmer le mot de passe
                </label>
                <input id="settings-confirm-password" type="password" autoComplete="new-password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className={inputClass} placeholder="••••••••" required minLength={8} maxLength={72} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="min-h-11 w-full rounded-full bg-primary px-8 py-3 font-headline font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-50 md:w-auto">
              {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>

          <form onSubmit={handleEmailChange} className="space-y-4 border-t border-outline-variant/15 pt-8">
            <h3 className="font-headline text-base font-bold text-on-surface">Changer d’adresse e-mail</h3>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-new-email" className="font-inter text-sm font-semibold text-on-surface-variant">
                Nouvelle adresse
              </label>
              <input id="settings-new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} placeholder="nouvelle@adresse.fr" maxLength={254} required />
            </div>
            <p className="text-xs text-on-surface-variant">Un lien de confirmation sera envoyé à la nouvelle adresse.</p>
            <button type="submit" disabled={emailLoading} className="btn-secondary min-h-11 px-6">
              {emailLoading ? 'Envoi…' : 'Envoyer le lien de confirmation'}
            </button>
          </form>
        </div>
      </section>

      <section id="notifications" aria-labelledby="notifications-title" className="scroll-mt-28 space-y-8">
        <div className="space-y-2">
          <h2 id="notifications-title" className="font-headline text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
            Notifications par e-mail
          </h2>
          <p className="text-on-surface-variant">Choisissez ce que vous voulez recevoir. Les e-mails liés à la sécurité du compte sont toujours envoyés.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {NOTIFICATION_ITEMS.map(({ key, title, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
              <div className="min-w-0 space-y-1">
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  <label htmlFor={`notif-${key}`}>{title}</label>
                </h3>
                <p className="text-sm text-on-surface-variant">{desc}</p>
              </div>
              <SettingsToggle id={`notif-${key}`} checked={notificationSettings[key]} onChange={() => handleNotificationToggle(key)} />
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-28 space-y-8">
        <div className="space-y-2">
          <h2 id="privacy-title" className="font-headline text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
            Confidentialité et données
          </h2>
          <p className="text-on-surface-variant">
            Ce que les autres membres voient de vous, et vos droits sur vos données.{' '}
            {onLegal ? (
              <button type="button" onClick={() => onLegal('confidentialite')} className="font-semibold text-primary hover:underline">
                Lire la politique de confidentialité
              </button>
            ) : null}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-6 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                <span className="material-symbols-outlined" aria-hidden>
                  {visibility === 'public' ? 'visibility' : 'visibility_off'}
                </span>
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">Visibilité du profil</h3>
                <p className="text-sm text-on-surface-variant">
                  Statut : <span className="font-bold text-primary">{visibility === 'public' ? 'Public' : 'Privé'}</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant">
              En privé, votre biographie, vos langues et vos compétences sont masquées. Vos annonces, votre nom, votre ville et votre note restent visibles : ils sont nécessaires pour échanger.
            </p>
            <button type="button" onClick={handleToggleProfileVisibility} disabled={privacyLoading} className="min-h-11 w-full rounded-xl bg-surface-container-low py-4 font-headline font-bold text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60">
              {privacyLoading ? 'Mise à jour…' : visibility === 'public' ? 'Rendre le profil privé' : 'Rendre le profil public'}
            </button>
          </div>

          <div className="space-y-6 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined" aria-hidden>
                  download
                </span>
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">Télécharger mes données</h3>
                <p className="text-sm text-on-surface-variant">Une copie de vos données au format JSON (droit à la portabilité).</p>
              </div>
            </div>
            <button type="button" onClick={handleExportData} disabled={exportLoading} className="min-h-11 w-full rounded-xl border-2 border-outline-variant/30 py-4 font-headline font-bold text-on-surface transition-all hover:border-primary disabled:opacity-60">
              {exportLoading ? 'Préparation…' : 'Télécharger l’export'}
            </button>
          </div>
        </div>
      </section>

      <section id="danger" aria-labelledby="danger-title" className="scroll-mt-28 space-y-8 pb-8">
        <div className="space-y-2">
          <h2 id="danger-title" className="font-headline text-xl font-bold tracking-tight text-error sm:text-2xl">
            Supprimer mon compte
          </h2>
          <p className="text-on-surface-variant">Vos annonces sont retirées, vos propositions en cours annulées et votre profil anonymisé. Les échanges déjà réalisés restent consultables par l’autre partie, sans vos données personnelles.</p>
        </div>
        <div className="flex flex-col gap-6 rounded-3xl border-2 border-error/20 bg-error-container/20 p-8 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 space-y-2">
            <label htmlFor="delete-confirm" className="block text-sm font-semibold text-on-error-container">
              Tapez SUPPRIMER pour confirmer
            </label>
            <input id="delete-confirm" type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="w-full max-w-xs rounded-xl border border-error/30 bg-surface-container-lowest px-4 py-3 text-on-surface" autoComplete="off" />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER'}
            className="min-h-12 shrink-0 rounded-full bg-error px-8 py-4 font-headline font-bold text-on-error shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {deleteLoading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </section>
    </div>
  );
}
