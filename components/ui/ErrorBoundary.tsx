'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-border-custom bg-bg-card rounded-xl max-w-md mx-auto my-8 transition-theme">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-red/10 text-accent-red mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-2">
            System Connection Interrupted
          </h3>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            {this.state.error?.message || 'Stock data currently unavailable. Please verify connection and ticker symbols.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-accent-blue rounded-xl hover:bg-opacity-95 cursor-pointer shadow-md shadow-accent-blue/10 hover:shadow-accent-blue/20 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
