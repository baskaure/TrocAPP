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
          padding: '40px',
          maxWidth: '600px',
          margin: '40px auto',
          backgroundColor: '#fee',
          borderRadius: '8px',
          border: '2px solid #fcc'
        }}>
          <h1 style={{ color: '#c00', marginBottom: '20px' }}>Erreur de chargement</h1>
          <p style={{ marginBottom: '20px' }}>Une erreur s'est produite lors du chargement de l'application.</p>
          <details style={{
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Détails de l'erreur</summary>
            <pre style={{
              marginTop: '10px',
              overflow: 'auto',
              fontSize: '12px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px'
            }}>
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2D8DBF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
