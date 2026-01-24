import { useEffect, useState } from 'react';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { 
    needRefresh, 
    handleUpdate, 
    dismissUpdate, 
    forceRefresh,
    forceUpdateRequired,
    currentVersion 
  } = usePWAUpdate();

  useEffect(() => {
    if (needRefresh && !dismissed) {
      setShowPrompt(true);
    }
  }, [needRefresh, dismissed]);

  const onUpdate = () => {
    if (forceUpdateRequired) {
      forceRefresh();
    } else {
      handleUpdate();
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    setDismissed(true);
    dismissUpdate();
  };

  if (!showPrompt) return null;

  // Update available UI - can be dismissed but shows indicator
  if (forceUpdateRequired) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[9999] md:left-auto md:right-4 md:max-w-sm md:bottom-4">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl shadow-2xl p-4 flex items-center justify-between gap-3 animate-fade-in border border-amber-400/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Nova versão disponível!</p>
              <p className="text-xs opacity-90">v{currentVersion} - Recomendamos atualizar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Atualizar
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal update prompt
  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center justify-between gap-3 animate-fade-in md:left-auto md:right-4 md:max-w-sm md:bottom-4">
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
