import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in BlinkReader:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#18181c] text-[#e8e8ec] flex items-center justify-center p-6 font-sans">
          <div className="bg-[#222228] border border-[#33333c] rounded-[24px] p-8 max-w-lg w-full shadow-2xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-[16px] bg-[#653a2c] text-[#F8B7A2] flex items-center justify-center mb-5">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h1 className="text-2xl font-extrabold tracking-tight text-[#e8e8ec] mb-2">
              Algo inesperado aconteceu
            </h1>
            
            <p className="text-sm text-[#9a9aa3] mb-6 leading-relaxed">
              Ocorreu um erro ao carregar a interface. Você pode recarregar a página ou restaurar os dados locais para continuar lendo normalmente.
            </p>

            {this.state.error && (
              <div className="w-full bg-[#18181c] border border-[#33333c] rounded-[12px] p-3 mb-6 text-left overflow-x-auto text-xs font-mono text-[#ff6b63]">
                {this.state.error.message || 'Erro desconhecido'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FCFD76] hover:bg-[#eef05a] text-[#212121] rounded-[12px] text-sm font-bold transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-[#18181c] hover:bg-[#2a2a32] text-[#9a9aa3] hover:text-[#e8e8ec] border border-[#33333c] rounded-[12px] text-sm font-semibold transition-all cursor-pointer"
              >
                Limpar Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
