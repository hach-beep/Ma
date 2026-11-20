import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      let friendly = 'تعذر إتمام العملية بسبب قيود الصلاحيات أو الاتصال.';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendly = `تعذر الوصول إلى البيانات (${parsed.operationType ?? 'read'}): ${parsed.error}`;
        }
      } catch {
        friendly = this.state.errorMessage;
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              حدث خلل مؤقت في النظام
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-semibold hover:bg-[#1D3E85] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
