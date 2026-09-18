import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Filet de sécurité : en production, seul un message générique est affiché.
 * La trace complète n'est montrée qu'en développement.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erreur interceptée :', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background px-5 py-10 font-inter text-on-surface">
          <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-soft-lg sm:p-10">
            <h1 className="mb-3 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Un problème est survenu</h1>
            <p className="mb-6 text-sm text-on-surface-variant">
              La page n’a pas pu s’afficher. Rechargez-la ; si le problème persiste, écrivez-nous à{' '}
              <a href="mailto:contact@bontroc.fr" className="font-semibold text-primary hover:underline">
                contact@bontroc.fr
              </a>
              .
            </p>
            {import.meta.env.DEV ? (
              <details className="mb-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                <summary className="cursor-pointer text-sm font-semibold">Détails (développement)</summary>
                <pre className="mt-3 overflow-auto rounded-xl bg-surface-container-lowest p-3 text-xs">
                  {this.state.error?.toString()}
                  {'\n\n'}
                  {this.state.error?.stack}
                </pre>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.location.reload()} className="btn-primary min-h-11 px-6">
                Recharger la page
              </button>
              <a href="/" className="btn-secondary min-h-11 px-6">
                Retour à l’accueil
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
