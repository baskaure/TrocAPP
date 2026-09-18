import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { PageBackLink } from '../layout/PageBackLink';
import { BackgroundGradientAnimation } from '../ui/background-gradient-animation';
import { USERNAME_RE, normalizeUsername } from '../../lib/labels';
import type { LegalSection } from '../../lib/router';

export type AuthMode = 'login' | 'register' | 'forgot';

export type AuthPageProps = {
  onBack: () => void;
  initialMode?: 'login' | 'register';
  variant?: 'standalone' | 'embedded';
  onAuthenticated?: () => void;
  onModeChange?: (mode: 'login' | 'register') => void;
  onLegal?: (section: LegalSection) => void;
};

const inputClass =
  'w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function AuthPage({
  onBack,
  initialMode = 'login',
  variant = 'embedded',
  onAuthenticated,
  onModeChange,
  onLegal,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
  const { signIn, signUp, requestPasswordReset } = useAuth();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Retour depuis Google via le bfcache : les effets ne rejouent pas, on réactive le bouton.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogleLoading(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Disponibilité du nom d'utilisateur (debounce).
  useEffect(() => {
    if (mode !== 'register') return;
    const value = username.trim();
    if (!value) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const id = window.setTimeout(async () => {
      const { data } = await supabase.from('public_profiles').select('id').eq('username', value).limit(1);
      setUsernameStatus(data && data.length > 0 ? 'taken' : 'free');
    }, 400);
    return () => window.clearTimeout(id);
  }, [username, mode]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
    if (next !== 'forgot') onModeChange?.(next);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/annonces` },
      });
      if (oAuthError) throw oAuthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connexion Google impossible pour le moment.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email);
        setInfo('Si un compte existe avec cette adresse, vous recevrez un lien pour choisir un nouveau mot de passe.');
        return;
      }
      if (mode === 'login') {
        await signIn(email, password);
        onAuthenticated?.();
        return;
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      if (!USERNAME_RE.test(username.trim())) {
        setError('Le nom d’utilisateur doit contenir entre 3 et 30 caractères : lettres minuscules, chiffres et _.');
        return;
      }
      if (usernameStatus === 'taken') {
        setError('Ce nom d’utilisateur est déjà pris.');
        return;
      }
      const { needsEmailConfirmation } = await signUp(email, password, displayName.trim(), username.trim());
      if (needsEmailConfirmation) {
        setInfo(`Compte créé ! Confirmez votre adresse en cliquant sur le lien envoyé à ${email.trim()}, puis connectez-vous.`);
        setMode('login');
        setPassword('');
        onModeChange?.('login');
      } else {
        onAuthenticated?.();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={googleLoading}
      className="mb-5 flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
      </svg>
      <span>{googleLoading ? 'Connexion…' : 'Continuer avec Google'}</span>
    </button>
  );

  const divider = (
    <div className="mb-5 flex items-center gap-3" aria-hidden>
      <div className="h-px flex-1 bg-surface-container-high" />
      <span className="text-xs uppercase tracking-wider text-on-surface-variant">ou</span>
      <div className="h-px flex-1 bg-surface-container-high" />
    </div>
  );

  const usernameHint =
    usernameStatus === 'taken'
      ? { text: 'Déjà pris', cls: 'text-error' }
      : usernameStatus === 'free'
        ? { text: 'Disponible', cls: 'text-primary' }
        : usernameStatus === 'invalid'
          ? { text: '3 à 30 caractères : a-z, 0-9 et _', cls: 'text-error' }
          : usernameStatus === 'checking'
            ? { text: 'Vérification…', cls: 'text-on-surface-variant' }
            : null;

  const formFields = (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      {isRegister && (
        <>
          <div>
            <label htmlFor="auth-display-name" className="mb-1.5 block text-xs font-medium text-on-surface">
              Nom d&apos;affichage
            </label>
            <input
              id="auth-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jean Dupont"
              className={inputClass}
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          <div>
            <label htmlFor="auth-username" className="mb-1.5 block text-xs font-medium text-on-surface">
              Nom d&apos;utilisateur
            </label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              placeholder="jeandupont"
              className={inputClass}
              required
              minLength={3}
              maxLength={30}
              aria-describedby="auth-username-hint"
            />
            <p id="auth-username-hint" className={`mt-1 text-xs ${usernameHint?.cls ?? 'text-on-surface-variant'}`}>
              {usernameHint?.text ?? 'Visible par les autres membres, sans espace ni accent.'}
            </p>
          </div>
        </>
      )}

      <div>
        <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-on-surface">
          Adresse e-mail
        </label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className={inputClass}
          required
          maxLength={254}
        />
      </div>

      {!isForgot ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="auth-password" className="block text-xs font-medium text-on-surface">
              Mot de passe
            </label>
            {isLogin ? (
              <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-primary hover:underline">
                Mot de passe oublié ?
              </button>
            ) : null}
          </div>
          <input
            id="auth-password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            required
            minLength={isRegister ? 8 : 6}
            maxLength={72}
          />
          {isRegister ? <p className="mt-1 text-xs text-on-surface-variant">8 caractères minimum.</p> : null}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-error-container bg-error-container/30 p-3 text-sm text-error">
          {error}
        </div>
      ) : null}
      {info ? (
        <div role="status" className="rounded-lg border border-primary/20 bg-primary-fixed/30 p-3 text-sm text-on-primary-fixed">
          {info}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 min-h-11 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Chargement…' : isLogin ? 'Se connecter' : isRegister ? 'Créer mon compte' : 'Envoyer le lien'}
      </button>

      {isRegister ? (
        <p className="text-center text-xs text-on-surface-variant">
          En créant un compte, vous acceptez les{' '}
          <a
            href="/cgu"
            onClick={(e) => {
              if (!onLegal) return;
              e.preventDefault();
              onLegal('cgu');
            }}
            className="font-semibold text-primary hover:underline"
          >
            conditions d’utilisation
          </a>{' '}
          et la{' '}
          <a
            href="/confidentialite"
            onClick={(e) => {
              if (!onLegal) return;
              e.preventDefault();
              onLegal('confidentialite');
            }}
            className="font-semibold text-primary hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </p>
      ) : null}
    </form>
  );

  const switchModeLink = (
    <p className="mt-7 text-center text-sm text-on-surface-variant">
      {isForgot ? (
        <button type="button" onClick={() => switchMode('login')} className="font-semibold text-on-surface hover:underline">
          Retour à la connexion
        </button>
      ) : (
        <>
          {isLogin ? "Vous n'avez pas de compte ? " : 'Vous avez déjà un compte ? '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'register' : 'login')}
            className="font-semibold text-on-surface hover:underline"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </>
      )}
    </p>
  );

  const heading = isLogin ? 'Connexion' : isRegister ? 'Créer un compte' : 'Mot de passe oublié';
  const subheading = isLogin
    ? 'Bon retour ! Connectez-vous pour continuer.'
    : isRegister
      ? "Lancez-vous en quelques secondes, c'est gratuit."
      : 'Indiquez votre e-mail : nous vous envoyons un lien pour en choisir un nouveau.';

  if (variant === 'standalone') {
    return (
      <div className="flex min-h-screen w-full bg-surface-container-lowest font-inter">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(13, 15, 20)"
          gradientBackgroundEnd="rgb(0, 30, 55)"
          firstColor="45, 141, 191"
          secondColor="137, 192, 220"
          thirdColor="0, 90, 140"
          fourthColor="10, 74, 97"
          fifthColor="184, 227, 245"
          pointerColor="45, 141, 191"
          interactive={false}
          containerClassName="relative hidden flex-1 md:flex"
        >
          <button
            type="button"
            onClick={onBack}
            className="absolute left-8 top-8 z-20 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              arrow_back
            </span>
            Retour
          </button>

          <div className="flex h-full w-full items-center justify-center px-10">
            <img src="/logo/5.png" alt="BonTroc" width={462} height={102} className="h-16 w-auto object-contain brightness-0 invert" />
          </div>
        </BackgroundGradientAnimation>

        <main className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 md:hidden">
              <PageBackLink onClick={onBack} label="Retour" />
            </div>

            <h1 className="mb-2 text-center font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">{heading}</h1>
            <p className="mb-7 text-center text-sm text-on-surface-variant">{subheading}</p>

            {!isForgot ? googleButton : null}
            {!isForgot ? divider : null}
            {formFields}
            {switchModeLink}

            <p className="mt-8 text-center text-xs text-on-surface-variant">
              © BonTroc ·{' '}
              <a
                href="/confidentialite"
                onClick={(e) => {
                  if (!onLegal) return;
                  e.preventDefault();
                  onLegal('confidentialite');
                }}
                className="hover:text-on-surface"
              >
                Confidentialité
              </a>{' '}
              ·{' '}
              <a
                href="/cgu"
                onClick={(e) => {
                  if (!onLegal) return;
                  e.preventDefault();
                  onLegal('cgu');
                }}
                className="hover:text-on-surface"
              >
                CGU
              </a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <PageBackLink onClick={onBack} label="Retour" />
      <div className="relative w-full rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg sm:p-8">
        <h2 className="mb-1 font-headline text-2xl font-semibold text-on-surface">{heading}</h2>
        <p className="mb-6 text-sm text-on-surface-variant">{subheading}</p>
        {!isForgot ? googleButton : null}
        {!isForgot ? divider : null}
        {formFields}
        {switchModeLink}
      </div>
    </div>
  );
}
