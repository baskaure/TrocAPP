import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { PageBackLink } from '../layout/PageBackLink';
import { BackgroundGradientAnimation } from '../ui/background-gradient-animation';

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

  // Quand le navigateur restaure la page depuis le bfcache (retour depuis Google OAuth),
  // les useEffect ne se réexécutent pas — on remet googleLoading à false manuellement.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogleLoading(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

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

  const isLogin = mode === 'login';

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={googleLoading}
      className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>
      <span>{googleLoading ? 'Connexion...' : 'Continuer avec Google'}</span>
    </button>
  );

  const divider = (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs uppercase tracking-wider text-slate-400">ou</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );

  const formFields = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isLogin && (
        <>
          <div>
            <label htmlFor="auth-display-name" className="mb-1.5 block text-xs font-medium text-slate-700">
              Nom d&apos;affichage
            </label>
            <input
              id="auth-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div>
            <label htmlFor="auth-username" className="mb-1.5 block text-xs font-medium text-slate-700">
              Nom d&apos;utilisateur
            </label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jeandupont"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-slate-700">
          Adresse e-mail
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@bontroc.fr"
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <div>
        <label htmlFor="auth-password" className="mb-1.5 block text-xs font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          required
          minLength={6}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-error-container bg-error-container/30 p-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
      </button>
    </form>
  );

  const switchModeLink = (
    <p className="mt-7 text-center text-sm text-slate-500">
      {isLogin ? "Vous n'avez pas de compte ? " : 'Vous avez déjà un compte ? '}
      <button
        type="button"
        onClick={() => setMode(isLogin ? 'register' : 'login')}
        className="font-semibold text-slate-900 hover:underline"
      >
        {isLogin ? "S'inscrire" : 'Se connecter'}
      </button>
    </p>
  );

  // ── Variante standalone : split-screen plein écran ────────────────────────
  if (variant === 'standalone') {
    return (
      <div className="flex min-h-screen w-full bg-white font-inter">
        {/* Panneau gauche (visuel) */}
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(13, 15, 20)"
          gradientBackgroundEnd="rgb(0, 30, 55)"
          firstColor="45, 141, 191"
          secondColor="137, 192, 220"
          thirdColor="0, 90, 140"
          fourthColor="10, 74, 97"
          fifthColor="184, 227, 245"
          pointerColor="45, 141, 191"
          containerClassName="relative hidden flex-1 md:flex"
        >
          {/* Lien retour */}
          <button
            type="button"
            onClick={onBack}
            className="absolute left-8 top-8 z-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Retour
          </button>

          {/* Logo seul, centré */}
          <div className="flex h-full w-full items-center justify-center px-10">
            <img
              src="/logo/5.png"
              alt="BonTroc"
              className="h-16 w-auto object-contain brightness-0 invert md:h-18"
            />
          </div>
        </BackgroundGradientAnimation>

        {/* Panneau droit (formulaire) */}
        <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
          <div className="w-full max-w-sm">
            {/* Lien retour mobile uniquement */}
            <div className="mb-6 md:hidden">
              <PageBackLink onClick={onBack} label="Retour" />
            </div>

            <h1 className="mb-2 text-center font-manrope text-2xl font-semibold tracking-tight text-slate-900 md:text-[28px]">
              {isLogin ? 'Connexion' : 'Créer un compte'}
            </h1>
            <p className="mb-7 text-center text-sm text-slate-500">
              {isLogin
                ? 'Bon retour ! Connectez-vous pour continuer.'
                : "Lancez-vous en quelques secondes — c'est gratuit."}
            </p>

            {googleButton}
            {divider}
            {formFields}
            {switchModeLink}

            <p className="mt-8 text-center text-xs text-slate-400">
              © BonTroc · <a href="#" className="hover:text-slate-600">Confidentialité</a> ·{' '}
              <a href="#" className="hover:text-slate-600">CGU</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Variante embedded : carte dans la mise en page de l'app ──────────────
  return (
    <div className="w-full max-w-md">
      <PageBackLink onClick={onBack} label="Retour" />
      <div className="relative w-full rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <h2 className="mb-1 font-manrope text-2xl font-semibold text-on-surface">
          {isLogin ? 'Connexion' : 'Créer un compte'}
        </h2>
        <p className="mb-6 text-sm text-on-surface-variant">
          Accédez à BonTroc pour publier vos annonces et gérer vos échanges en toute simplicité.
        </p>
        {googleButton}
        {divider}
        {formFields}
        {switchModeLink}
      </div>
    </div>
  );
}
