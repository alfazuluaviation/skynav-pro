import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IconGoogle } from './Icons';
import logoSkyFPL from '@/assets/logo-skyfpl.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Use production URL for OAuth redirect
  const getRedirectUrl = () => {
    if (window.location.hostname === 'localhost') {
      return 'https://skyfpl.lovable.app';
    }
    return window.location.origin;
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
      },
    });
    if (error) setMessage({ type: 'error', text: error.message });
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(),
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      if (isSignUp) {
        setMessage({ type: 'success', text: 'Verifique seu e-mail para confirmar o cadastro!' });
      } else {
        // Login successful
        onSuccess?.();
        onClose();
      }
    }
    setLoading(false);
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setMessage(null);
    setIsSignUp(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-slate-800 p-8 rounded-[2.5rem] shadow-3xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="flex flex-col items-center mb-6">
          <img
            src={logoSkyFPL}
            alt="SkyFPL Logo"
            className="w-24 h-24 md:w-28 md:h-28 object-contain drop-shadow-2xl"
          />
          <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.2em] mt-2">
            Faça login para continuar
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full bg-[#161b22] hover:bg-[#21262d] border border-slate-700/50 py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-3 transition-all mb-4"
        >
          <IconGoogle />
          <span className="text-[11px] uppercase tracking-widest">Entrar com Google</span>
        </button>

        <div className="relative flex items-center justify-center my-5">
          <div className="w-full h-px bg-slate-800"></div>
          <span className="absolute px-4 bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600">
            Ou use e-mail
          </span>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d1117] border border-slate-700/50 rounded-2xl py-3 px-5 text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-700"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0d1117] border border-slate-700/50 rounded-2xl py-3 px-5 text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-700"
              placeholder="••••••••"
              required
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold text-center ${
                message.type === 'error'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 py-3 rounded-2xl text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[11px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};
