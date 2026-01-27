import React, { useState, useEffect } from 'react';
import { syncAllNavigationData, getSyncStatus, isSyncNeeded } from '../services/NavigationSyncService';
import { clearNavigationCache, getNavCacheStats } from '../services/NavigationCacheService';

interface NavigationSyncButtonProps {
  compact?: boolean;
}

export const NavigationSyncButton: React.FC<NavigationSyncButtonProps> = ({ compact = false }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<{
    isSynced: boolean;
    lastSync: Date | null;
    totalPoints: number;
    needsSync: boolean;
  } | null>(null);

  // Load sync status on mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  const handleSync = async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    setProgress(0);
    setMessage('Iniciando sincronização...');

    try {
      const result = await syncAllNavigationData((prog, msg) => {
        setProgress(prog);
        setMessage(msg);
      });

      if (result.success) {
        setMessage(`✓ ${result.totalPoints} pontos sincronizados!`);
      } else {
        setMessage(`✗ Erro: ${result.error}`);
      }

      await loadSyncStatus();
    } catch (error) {
      setMessage('Erro na sincronização');
      console.error('[NavSync] Error:', error);
    } finally {
      setIsSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleClearCache = async () => {
    if (isSyncing) return;
    
    if (confirm('Tem certeza que deseja limpar o cache de navegação? Você precisará sincronizar novamente para uso offline.')) {
      await clearNavigationCache();
      await loadSyncStatus();
      setMessage('Cache limpo');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (compact) {
    return (
      <button
        onClick={handleSync}
        disabled={isSyncing || !navigator.onLine}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          isSyncing 
            ? 'bg-purple-500/20 text-purple-400 cursor-wait'
            : syncStatus?.needsSync
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
        } ${!navigator.onLine ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isSyncing ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">{progress}%</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-bold">
              {syncStatus?.isSynced ? 'Atualizar' : 'Sincronizar'}
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="font-bold text-white text-sm">Dados de Navegação</span>
        </div>
        
        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
          syncStatus?.isSynced 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            syncStatus?.isSynced ? 'bg-emerald-400' : 'bg-amber-400'
          }`} />
          {syncStatus?.isSynced ? 'SINCRONIZADO' : 'PENDENTE'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-700/30 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Pontos</div>
          <div className="text-lg font-black text-white">
            {syncStatus?.totalPoints?.toLocaleString() || 0}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Última Sync</div>
          <div className="text-xs font-bold text-slate-300">
            {formatDate(syncStatus?.lastSync || null)}
          </div>
        </div>
      </div>

      {/* Progress bar (when syncing) */}
      {isSyncing && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{message}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Message */}
      {!isSyncing && message && (
        <div className={`text-xs font-medium mb-3 px-2 py-1.5 rounded-lg ${
          message.startsWith('✓') 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : message.startsWith('✗')
              ? 'bg-red-500/20 text-red-400'
              : 'bg-slate-700/50 text-slate-300'
        }`}>
          {message}
        </div>
      )}

      {/* Description */}
      <p className="text-[11px] text-slate-400 mb-4">
        Sincronize todos os aeródromos, helipontos, VORs, NDBs e waypoints do Brasil para uso offline durante o voo.
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing || !navigator.onLine}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${
            isSyncing
              ? 'bg-purple-500/20 text-purple-400 cursor-wait'
              : !navigator.onLine
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600 active:scale-[0.98]'
          }`}
        >
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncStatus?.isSynced ? 'Atualizar Dados' : 'Sincronizar Agora'}
            </>
          )}
        </button>

        {syncStatus?.totalPoints && syncStatus.totalPoints > 0 && (
          <button
            onClick={handleClearCache}
            disabled={isSyncing}
            className="p-2.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all disabled:opacity-50"
            title="Limpar cache"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {!navigator.onLine && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Conecte-se à internet para sincronizar
        </div>
      )}
    </div>
  );
};
