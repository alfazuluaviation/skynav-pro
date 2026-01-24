import { useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';

interface UseAuthGuardReturn {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  pendingAction: (() => void) | null;
  requireAuth: (callback: () => void) => void;
  executePendingAction: () => void;
  clearPendingAction: () => void;
}

export const useAuthGuard = (session: Session | null): UseAuthGuardReturn => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((callback: () => void) => {
    if (session) {
      // User is logged in, execute immediately
      callback();
    } else {
      // User not logged in, store action and show login modal
      setPendingAction(() => callback);
      setShowAuthModal(true);
    }
  }, [session]);

  const executePendingAction = useCallback(() => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    showAuthModal,
    setShowAuthModal,
    pendingAction,
    requireAuth,
    executePendingAction,
    clearPendingAction,
  };
};
