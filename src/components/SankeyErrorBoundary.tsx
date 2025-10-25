import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error Boundary to catch rendering errors in Sankey diagrams
 * Particularly useful for catching stack overflow errors
 */
export class SankeyErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sankey Error Boundary caught error:', error, errorInfo);
    this.props.onError(error);

    // Reset error state after a short delay to allow re-renders
    setTimeout(() => {
      this.setState({ hasError: false });
    }, 100);
  }

  render() {
    if (this.state.hasError) {
      return null; // Error is handled by parent component
    }
    return this.props.children;
  }
}
