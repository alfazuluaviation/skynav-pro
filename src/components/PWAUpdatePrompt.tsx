import { RefreshCw, X } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdatePrompt = () => {
  const { 
    needRefresh, 
    handleUpdate, 
    dismissUpdate, 
    currentVersion 
  } = usePWAUpdate();

  // Don't show anything if no update needed or offline
  if (!needRefresh || !navigator.onLine) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] md:left-auto md:right-4 md:max-w-sm md:bottom-4">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl shadow-2xl p-4 flex items-center justify-between gap-3 animate-fade-in border border-primary/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Nova versão disponível!</p>
            <p className="text-xs opacity-90">v{currentVersion}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Atualizar
          </button>
          <button
            onClick={dismissUpdate}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
