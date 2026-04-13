import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { PageBackLink } from '../layout/PageBackLink';

export type AuthPageProps = {
  onBack: () => void;
  initialMode?: 'login' | 'register';
  variant?: 'standalone' | 'embedded';
  onAuthenticated?: () => void;
};

export function AuthPage({ onBack, initialMode = 'login', variant = 'embedded', onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oAuthError) throw oAuthError;
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as Error).message)
          : 'Erreur lors de la connexion Google';
      setError(msg);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName, username);
      }
      onAuthenticated?.();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Une erreur est survenue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inner = (
    <div className="relative w-full max-w-md rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg dark:border-slate-700 dark:bg-slate-900 sm:p-8">
      <h2 className="font-heading mb-1 text-2xl font-semibold text-on-surface">
        {mode === 'login' ? 'Connexion' : 'Créer un compte'}
      </h2>
      <p className="mb-6 text-sm text-on-surface-variant">
        Accédez à BonTroc pour publier vos annonces et gérer vos échanges en toute simplicité.
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="mb-4 flex w-full items-center justify-center space-x-3 rounded-full border border-outline-variant/30 bg-surface-container-low py-2.5 text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>{googleLoading ? 'Connexion...' : 'Continuer avec Google'}</span>
      </button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant/30" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-surface-container-lowest px-2 text-on-surface-variant dark:bg-slate-900">ou</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Nom d&apos;affichage</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-on-surface-variant">Nom d&apos;utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
                required
              />
            </div>
          </>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-on-surface-variant">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-on-surface-variant">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
            required
            minLength={6}
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-error-container bg-error-container/20 p-3 text-sm text-error">{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary py-2.5 font-headline font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-sm text-primary hover:underline"
        >
          {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );

  if (variant === 'standalone') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-on-surface">
        <div className="w-full max-w-md">
          <PageBackLink onClick={onBack} label="Retour" />
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <PageBackLink onClick={onBack} label="Retour" />
      {inner}
    </div>
  );
}
