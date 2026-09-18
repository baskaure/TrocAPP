import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useNotice } from '../ui/Toast';

type ResetPasswordPageProps = {
  onDone: () => void;
  onCancel: () => void;
};

const inputClass =
  'w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Écran de saisie d'un nouveau mot de passe après un lien « mot de passe oublié ». */
export function ResetPasswordPage({ onDone, onCancel }: ResetPasswordPageProps) {
  const { session, passwordRecovery, updatePassword } = useAuth();
  const { toast } = useNotice();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canReset = Boolean(session) && (passwordRecovery || Boolean(session));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success('Mot de passe mis à jour. Vous êtes connecté.');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface-container-lowest px-6 py-12 font-inter">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
          Nouveau mot de passe
        </h1>
        <p className="mb-7 text-center text-sm text-on-surface-variant">
          {canReset
            ? 'Choisissez un mot de passe d’au moins 8 caractères.'
            : 'Ce lien n’est plus valide ou a expiré. Demandez un nouveau lien depuis la page de connexion.'}
        </p>

        {canReset ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-password" className="mb-1.5 block text-xs font-medium text-on-surface">
                Nouveau mot de passe
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
                minLength={8}
                maxLength={72}
              />
            </div>
            <div>
              <label htmlFor="reset-confirm" className="mb-1.5 block text-xs font-medium text-on-surface">
                Confirmer le mot de passe
              </label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                required
                minLength={8}
                maxLength={72}
              />
            </div>
            {error ? (
              <div role="alert" className="rounded-lg border border-error-container bg-error-container/30 p-3 text-sm text-error">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={onCancel} className="btn-primary min-h-11 w-full">
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
