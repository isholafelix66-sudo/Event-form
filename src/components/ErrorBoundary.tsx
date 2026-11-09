import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    // Reset any query/hash if needed and go home
    if (window.location.hash) {
      window.location.hash = '';
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const errorText = `${this.state.error?.toString()}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 text-center space-y-6">
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Error Headlines */}
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                An unexpected interface issue occurred. Your event configurations and attendee records remain safe and saved.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>

              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
            </div>

            {/* Collapsible Error Diagnostics */}
            <div className="pt-4 border-t border-gray-100 text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-800 transition py-1 cursor-pointer"
              >
                <span>Technical diagnostic details</span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto space-y-3 relative">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                    <span>Error Log</span>
                    <button
                      onClick={this.handleCopyError}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      {this.state.copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Log
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-rose-400 font-bold whitespace-pre-wrap">
                    {this.state.error?.toString()}
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="text-slate-400 whitespace-pre-wrap text-[10px] leading-relaxed max-h-48 overflow-y-auto">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
