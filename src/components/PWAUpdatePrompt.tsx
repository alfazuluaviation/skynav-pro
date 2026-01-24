import { useEffect, useState } from 'react';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { 
    needRefresh, 
    handleUpdate, 
    dismissUpdate, 
    forceRefresh,
    forceUpdateRequired,
    currentVersion 
  } = usePWAUpdate();

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const onUpdate = () => {
    if (forceUpdateRequired) {
      // Force a complete refresh for version mismatches
      forceRefresh();
    } else {
      handleUpdate();
    }
  };

  const handleClose = () => {
    // Don't allow dismissing if force update is required
    if (forceUpdateRequired) {
      return;
    }
    setShowPrompt(false);
    dismissUpdate();
  };

  if (!showPrompt) return null;

  // Force update UI - cannot be dismissed
  if (forceUpdateRequired) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-orange-500/50 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Atualização Obrigatória</h3>
              <p className="text-xs text-slate-400">v{currentVersion}</p>
            </div>
          </div>
          
          <p className="text-slate-300 text-sm mb-6">
            Uma nova versão do SkyFPL está disponível. Para continuar usando o app, 
            é necessário atualizar agora.
          </p>
          
          <button
            onClick={onUpdate}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Atualizar Agora
          </button>
          
          <p className="text-xs text-slate-500 text-center mt-4">
            O app será recarregado automaticamente
          </p>
        </div>
      </div>
    );
  }

  // Normal update prompt - can be dismissed
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center justify-between gap-3 animate-fade-in md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <div>
          <p className="font-medium text-sm">Nova versão disponível!</p>
          <p className="text-xs opacity-80">v{currentVersion} - Toque para atualizar</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onUpdate}
          className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          Atualizar
        </button>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
