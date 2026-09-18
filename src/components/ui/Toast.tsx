import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

type NoticeContextValue = {
  toast: ToastApi;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const NoticeContext = createContext<NoticeContextValue | undefined>(undefined);

const ICONS: Record<ToastKind, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const TONES: Record<ToastKind, string> = {
  success: 'border-primary/30 bg-surface-container-lowest text-on-surface',
  error: 'border-error/30 bg-error-container text-on-error-container',
  info: 'border-outline-variant/30 bg-surface-container-lowest text-on-surface',
};

const ICON_TONES: Record<ToastKind, string> = {
  success: 'text-primary',
  error: 'text-error',
  info: 'text-on-surface-variant',
};

/**
 * Notifications non bloquantes (toasts) et boîte de confirmation accessible,
 * en remplacement de `alert()` / `confirm()` natifs.
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const counter = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, kind === 'error' ? 7000 : 4500);
  }, []);

  const toast = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (ok: boolean) => {
      confirmState?.resolve(ok);
      setConfirmState(null);
    },
    [confirmState],
  );

  useEffect(() => {
    if (!confirmState) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <NoticeContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft-lg animate-fade-up ${TONES[t.kind]}`}
          >
            <span className={`material-symbols-outlined text-[20px] ${ICON_TONES[t.kind]}`} aria-hidden>
              {ICONS[t.kind]}
            </span>
            <p className="flex-1 font-inter leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current/70 hover:bg-on-surface/5"
              aria-label="Fermer la notification"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                close
              </span>
            </button>
          </div>
        ))}
      </div>

      {confirmState ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-on-surface/40 p-4 backdrop-blur-sm sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Annuler"
            onClick={() => closeConfirm(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={confirmState.description ? 'confirm-description' : undefined}
            className="relative w-full max-w-md rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg sm:p-8"
          >
            <h2 id="confirm-title" className="font-headline text-xl font-bold text-on-surface">
              {confirmState.title}
            </h2>
            {confirmState.description ? (
              <p id="confirm-description" className="mt-2 text-sm text-on-surface-variant">
                {confirmState.description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="btn-secondary min-h-11"
              >
                {confirmState.cancelLabel ?? 'Annuler'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => closeConfirm(true)}
                className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-on-primary shadow-soft-lg transition-colors ${
                  confirmState.danger ? 'bg-error hover:brightness-95' : 'bg-primary hover:brightness-95'
                }`}
              >
                {confirmState.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NoticeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotice(): NoticeContextValue {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error('useNotice doit être utilisé dans un NoticeProvider');
  return ctx;
}
