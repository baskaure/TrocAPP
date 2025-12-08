import { useState } from 'react';
import { Lock, Bell, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

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
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Mot de passe modifié avec succès!');
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
      await supabase
        .from('users')
        .update({ notification_settings: newSettings })
        .eq('id', user.id);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('users')
        .update({ status: 'deleted' })
        .eq('id', user.id);

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
      // On stocke l'info dans les metadata Supabase pour éviter de casser le schéma existant
      const { error: updateError } = await supabase.auth.updateUser({
        data: { profile_visibility: nextVisibility },
      });

      if (updateError) throw updateError;

      setProfileVisibility(nextVisibility);
      setSuccess(
        nextVisibility === 'public'
          ? 'Profil rendu visible à tous.'
          : 'Profil rendu privé. Il ne sera visible que si vous partagez le lien.'
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de mettre à jour la visibilité pour le moment.'
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
      // Placeholder : envoie juste une confirmation locale.
      // À brancher sur une Edge Function d’export RGPD si disponible.
      setSuccess('Demande enregistrée. Vous recevrez un email avec vos données.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de traiter la demande pour le moment.'
      );
    } finally {
      setPrivacyLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          Veuillez vous connecter pour accéder aux paramètres
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-brand-text mb-6">Paramètres</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
          {success}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-3xl shadow-soft-lg p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <Lock className="w-6 h-6 text-brand-blue" />
            <h2 className="text-lg font-heading font-semibold text-brand-text">Sécurité</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                placeholder="Minimum 6 caractères"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-gray-50 focus:bg-white"
                placeholder="Retapez votre mot de passe"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-full px-6 py-2 disabled:opacity-50"
            >
              {loading ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-3xl shadow-soft-lg p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="w-6 h-6 text-brand-blue" />
            <h2 className="text-lg font-heading font-semibold text-brand-text">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-brand-text">Nouvelles propositions</h3>
                <p className="text-sm text-gray-500">Recevoir un email lors d'une nouvelle proposition</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('emailNewProposal')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.emailNewProposal ? 'bg-brand-blue' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.emailNewProposal ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Propositions acceptées</h3>
                <p className="text-sm text-gray-500">Notification quand votre proposition est acceptée</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('emailAcceptedProposal')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.emailAcceptedProposal ? 'bg-brand-blue' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.emailAcceptedProposal ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Nouveaux messages</h3>
                <p className="text-sm text-gray-500">Alerte email pour les nouveaux messages</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('emailNewMessage')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.emailNewMessage ? 'bg-brand-blue' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.emailNewMessage ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Résumé hebdomadaire</h3>
                <p className="text-sm text-gray-500">Recevoir un résumé de vos activités chaque semaine</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('emailWeeklyDigest')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.emailWeeklyDigest ? 'bg-brand-blue' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.emailWeeklyDigest ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-soft-lg p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-6 h-6 text-brand-blue" />
            <h2 className="text-lg font-heading font-semibold text-brand-text">Confidentialité</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-2xl">
              <h3 className="font-medium text-gray-900 mb-2">Visibilité du profil</h3>
              <p className="text-sm text-gray-600 mb-3">
                {profileVisibility === 'public'
                  ? 'Votre profil est actuellement visible par tous les utilisateurs de la plateforme.'
                  : 'Votre profil est actuellement privé.'}
              </p>
              <button
                onClick={handleToggleProfileVisibility}
                disabled={privacyLoading}
                className="text-brand-blue hover:text-sky-600 font-medium text-sm disabled:opacity-60"
              >
                {profileVisibility === 'public' ? 'Rendre mon profil privé' : 'Rendre mon profil public'}
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl">
              <h3 className="font-medium text-gray-900 mb-2">Télécharger mes données</h3>
              <p className="text-sm text-gray-600 mb-3">
                Obtenez une copie de toutes vos données (conforme RGPD).
              </p>
              <button
                onClick={handleRequestMyData}
                disabled={privacyLoading}
                className="text-brand-blue hover:text-sky-600 font-medium text-sm disabled:opacity-60"
              >
                Demander mes données
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-soft-lg p-6 border border-red-200/70">
          <div className="flex items-center space-x-3 mb-6">
            <Trash2 className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-600">Zone dangereuse</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Supprimer mon compte</h3>
              <p className="text-sm text-gray-600 mb-4">
                Cette action est irréversible. Toutes vos données seront définitivement supprimées.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Supprimer mon compte
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start space-x-2 p-3 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-semibold mb-1">Êtes-vous absolument sûr ?</p>
                      <p>Cette action ne peut pas être annulée. Vos annonces, messages et toutes vos données seront supprimés.</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Suppression...' : 'Oui, supprimer définitivement'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
