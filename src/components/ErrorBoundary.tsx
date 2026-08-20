import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: '40px 20px',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            padding: '40px',
            maxWidth: '560px',
            margin: '40px auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #c3c5d9',
            color: '#191c1d'
          }}>
            <h1 style={{ color: '#ba1a1a', marginBottom: '20px' }}>Erreur de chargement</h1>
            <p style={{ marginBottom: '20px' }}>Une erreur s'est produite lors du chargement de l'application.</p>
            <details style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: '1px solid #c3c5d9',
              marginBottom: '24px'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Détails de l'erreur</summary>
              <pre style={{
                marginTop: '12px',
                overflow: 'auto',
                fontSize: '12px',
                padding: '12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px'
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2D8DBF',
                color: 'white',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
