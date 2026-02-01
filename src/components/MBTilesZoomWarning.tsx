/**
 * MBTilesZoomWarning
 * Displays a warning when using MBTiles offline mode at low zoom levels.
 * Recommends zooming in to level 5+ for better map rendering.
 */

import { ZoomIn } from 'lucide-react';

interface MBTilesZoomWarningProps {
  show: boolean;
}

export const MBTilesZoomWarning: React.FC<MBTilesZoomWarningProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[2000] 
                    bg-cyan-600/95 text-white px-4 py-2 rounded-lg 
                    font-medium text-xs flex items-center gap-2 shadow-lg
                    border border-cyan-400/50 backdrop-blur-sm">
      <ZoomIn className="w-4 h-4" />
      <span>
        Modo offline: <strong>Zoom 5+</strong> recomendado para melhor visualização
      </span>
    </div>
  );
};

export default MBTilesZoomWarning;
