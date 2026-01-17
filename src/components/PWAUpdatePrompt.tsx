import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('SW Registered: ' + swUrl);
      // Check for updates every 30 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleClose = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
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
          onClick={handleUpdate}
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
