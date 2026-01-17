import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { needRefresh, handleUpdate, dismissUpdate } = usePWAUpdate();

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const onUpdate = () => {
    handleUpdate();
  };

  const handleClose = () => {
    setShowPrompt(false);
    dismissUpdate();
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center justify-between gap-3 animate-fade-in md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <div>
          <p className="font-medium text-sm">Nova versão disponível!</p>
          <p className="text-xs opacity-80">Toque para atualizar o app</p>
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
