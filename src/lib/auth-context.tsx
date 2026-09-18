import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, User, errorMessage } from './supabase';
import { sendTransactionalEmail } from './notifications';
import type { Session } from '@supabase/supabase-js';

export type AuthNotice = { kind: 'banned' | 'deleted' | 'profile-missing' | 'info'; message: string };

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Message à afficher (compte suspendu, supprimé, profil introuvable…). */
  authNotice: AuthNotice | null;
  clearAuthNotice: () => void;
  /** Vrai quand l'utilisateur arrive depuis un lien « mot de passe oublié ». */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    username: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const loadingUserIdRef = useRef<string | null>(null);

  const loadUserProfile = useCallback(async (sessionUser: Session['user']) => {
    try {
      let { data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).maybeSingle();
      if (error) throw error;

      if (!data) {
        // Le trigger de création de profil a pu échouer : on tente une création minimale.
        const meta = (sessionUser.user_metadata ?? {}) as Record<string, string | undefined>;
        const fallbackName = meta.display_name || meta.full_name || meta.name || sessionUser.email?.split('@')[0] || 'Membre';
        const fallbackUsername = (meta.username || sessionUser.email?.split('@')[0] || 'membre')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 24) || 'membre';
        const { error: insertError } = await supabase.from('users').insert({
          id: sessionUser.id,
          email: sessionUser.email,
          display_name: fallbackName.slice(0, 60),
          username: `${fallbackUsername}_${sessionUser.id.replace(/-/g, '').slice(0, 4)}`,
          avatar_url: meta.avatar_url || meta.picture || null,
        });
        if (!insertError) {
          ({ data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).maybeSingle());
          if (error) throw error;
        }
      }

      if (!data) {
        await supabase.auth.signOut();
        setUser(null);
        setPasswordRecovery(false);
        setAuthNotice({
          kind: 'profile-missing',
          message: 'Votre profil est introuvable. Contactez contact@bontroc.fr pour rétablir votre compte.',
        });
        return;
      }

      if (data.role === 'banned') {
        await supabase.auth.signOut();
        setUser(null);
        setPasswordRecovery(false);
        setAuthNotice({ kind: 'banned', message: 'Votre compte a été suspendu. Contactez contact@bontroc.fr pour toute question.' });
        return;
      }

      if (data.status === 'deleted') {
        await supabase.auth.signOut();
        setUser(null);
        setPasswordRecovery(false);
        setAuthNotice({ kind: 'deleted', message: 'Ce compte a été supprimé.' });
        return;
      }

      loadedUserIdRef.current = data.id;
      loadingUserIdRef.current = null;
      setUser(data as User);
    } catch (err) {
      console.error('Chargement du profil impossible :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // `onAuthStateChange` émet INITIAL_SESSION dès l'abonnement : c'est la seule source utilisée,
    // un appel parallèle à getSession() chargeait le profil deux fois (et faisait échouer le
    // repli de création de profil, la seconde lecture passant avant l'insertion de la première).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }

      if (!next?.user) {
        loadedUserIdRef.current = null;
        loadingUserIdRef.current = null;
        setUser(null);
        setPasswordRecovery(false);
        setLoading(false);
        return;
      }

      // Rafraîchissements de jeton et retours d'onglet : le profil est déjà chargé, on ne
      // recrée pas l'objet `user` (cela réinitialisait les formulaires en cours d'édition).
      const alreadyLoaded = loadedUserIdRef.current === next.user.id;
      if (alreadyLoaded && event !== 'USER_UPDATED') {
        setLoading(false);
        return;
      }
      if (loadingUserIdRef.current === next.user.id && event !== 'USER_UPDATED') return;

      loadingUserIdRef.current = next.user.id;
      // Tant que le profil n'est pas là, l'application reste en chargement : sans cela elle
      // affiche une fraction de seconde l'état déconnecté et renvoie vers la page de connexion.
      setLoading(true);
      void loadUserProfile(next.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) throw new Error('E-mail ou mot de passe incorrect.');
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Confirmez d’abord votre adresse e-mail (lien reçu à l’inscription).');
      }
      throw new Error(errorMessage(error));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, username: string) => {
    setAuthNotice(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), username: username.trim() },
        emailRedirectTo: `${window.location.origin}/connexion`,
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) throw new Error('Un compte existe déjà avec cet e-mail.');
      throw new Error(errorMessage(error));
    }

    if (data.user) {
      void sendTransactionalEmail('welcome', data.user.id, { display_name: displayName.trim(), username: username.trim() });
    }

    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession) {
        const { error } = await supabase.auth.signOut();
        if (error && !error.message?.toLowerCase().includes('session missing')) {
          console.warn('Erreur lors de la déconnexion :', error);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!message.toLowerCase().includes('session missing')) {
        console.warn('Exception lors de la déconnexion :', err);
      }
    } finally {
      loadedUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setPasswordRecovery(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    if (error) throw new Error(errorMessage(error));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(errorMessage(error));
    setPasswordRecovery(false);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw new Error(errorMessage(error));
      const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      if (data) setUser(data as User);
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    if (data) setUser(data as User);
  }, [user]);

  const deleteAccount = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) throw new Error('La suppression a échoué. Réessayez ou contactez contact@bontroc.fr.');
    if (data && data.error) throw new Error(String(data.error));
    // Le message doit survivre au rechargement déclenché par SettingsPage.
    try {
      sessionStorage.setItem('bontroc:notice', 'Votre compte a été supprimé. Merci d’avoir utilisé BonTroc.');
    } catch {
      /* stockage indisponible : on se contente du toast ci-dessous */
    }
    await signOut();
    setAuthNotice({ kind: 'info', message: 'Votre compte a été supprimé. Merci d’avoir utilisé BonTroc.' });
  }, [signOut]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      loading,
      authNotice,
      clearAuthNotice: () => setAuthNotice(null),
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      refreshUser,
      deleteAccount,
    }),
    [session, user, loading, authNotice, passwordRecovery, signIn, signUp, signOut, requestPasswordReset, updatePassword, updateProfile, refreshUser, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
