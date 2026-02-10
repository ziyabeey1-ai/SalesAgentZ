import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: ''
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Bilinmeyen bir hata oluştu.' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <h1 className="text-xl font-bold text-slate-900">Uygulama geçici olarak durdu</h1>
            <p className="mt-2 text-sm text-slate-600">
              Arayüzde beklenmeyen bir hata oluştu. Otopilot durumu korunur, güvenli şekilde yeniden yükleyebilirsiniz.
            </p>
            <pre className="mt-4 text-xs text-left bg-slate-100 rounded p-3 overflow-x-auto text-slate-700">{this.state.message}</pre>
            <button
              onClick={this.handleReload}
              className="mt-5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children || null;
  }
}