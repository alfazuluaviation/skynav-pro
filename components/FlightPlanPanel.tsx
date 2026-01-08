import React, { useState } from 'react';
import { 
  Save, FolderOpen, Maximize2, ArrowLeftRight, Trash2, 
  CheckCircle2, X, Plane, MapPin 
} from 'lucide-react';
// Importação corrigida para evitar o erro da image_318904.png
import { getMagDeclination } from '../utils/geoUtils'; 

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints, aircraftModel, plannedSpeed, onSavePlan, onLoadPlan
}) => {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [planName, setPlanName] = useState('');

  // Função para Salvar com Confirmação
  const handleSave = () => {
    if (!planName.trim()) return;
    
    // Executa a função de salvamento passada via props
    onSavePlan(planName);
    
    // Feedback visual para o piloto
    setIsSaveModalOpen(false);
    setShowSuccessToast(true);
    setPlanName('');

    // Remove o aviso de sucesso após 3 segundos
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <>
      {/* TOOLBAR RESTAURADA (image_3d5382.png) */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase italic">Plano de Voo</span>
        <div className="flex gap-1 items-center">
          {/* BOTÃO SALVAR - AGORA FUNCIONAL */}
          <button 
            onClick={() => setIsSaveModalOpen(true)} 
            title="Salvar Plano na Biblioteca" 
            className="p-2 rounded hover:bg-green-500/10 text-slate-500 hover:text-green-400 transition-all"
          >
            <Save size={18}/>
          </button>

          {/* BOTÃO BIBLIOTECA - AGORA FUNCIONAL */}
          <button 
            onClick={() => setIsLibraryOpen(true)} 
            title="Abrir Biblioteca de Planos" 
            className="p-2 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all"
          >
            <FolderOpen size={18}/>
          </button>
          
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          
          <button title="Expandir" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><Maximize2 size={18}/></button>
          <button title="Inverter" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><ArrowLeftRight size={18}/></button>
          <button title="Apagar" className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
        </div>
      </div>

      {/* MODAL DE SALVAMENTO */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-black uppercase text-sm mb-4 flex items-center gap-2">
              <Save size={16} className="text-green-400" /> Nomear Plano de Voo
            </h3>
            <input 
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white mb-6 outline-none focus:border-green-500 transition-all font-mono"
              placeholder="EX: SALVADOR PARA ARACAJU..."
              value={planName}
              onChange={(e) => setPlanName(e.target.value.toUpperCase())}
            />
            <div className="flex justify-end gap-3 font-black">
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-500 hover:text-white text-xs uppercase">Cancelar</button>
              <button 
                onClick={handleSave}
                disabled={!planName}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-xs uppercase transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE SUCESSO (Feedback para o piloto) */}
      {showSuccessToast && (
        <div className="fixed top-6 right-6 z-[4000] bg-green-500 text-black px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle2 size={20} />
          <span className="font-black uppercase text-xs">Plano de Voo salvo com sucesso na Biblioteca!</span>
        </div>
      )}

      {/* MODAL DA BIBLIOTECA (Simples para visualização) */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex items-center justify-center">
          <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-black uppercase tracking-tighter flex items-center gap-3">
                <FolderOpen className="text-blue-400" /> Biblioteca SkyNav
              </h2>
              <button onClick={() => setIsLibraryOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
               {/* Aqui entrará o mapeamento dos seus planos salvos */}
               <p className="text-slate-500 text-center italic text-sm font-mono">Carregando planos salvos...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};