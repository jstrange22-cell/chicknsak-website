import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
            color: '#fff',
            fontFamily: "'Inter', system-ui, sans-serif",
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <p
            style={{
              fontFamily: "'Great Vibes', cursive",
              fontSize: '2.5rem',
              color: '#FFCC00',
              margin: '0 0 0.25rem',
            }}
          >
            Boo Jack's
          </p>
          <p
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              margin: '0 0 2rem',
            }}
          >
            Chick-N-Sack
          </p>
          <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
            Something went wrong loading the site.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 2rem',
              background: '#FFCC00',
              color: '#000',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
