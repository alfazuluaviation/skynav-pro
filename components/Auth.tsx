
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { IconPlane, IconGoogle } from './Icons';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const handleGoogleAuth = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) setMessage({ type: 'error', text: error.message });
        setLoading(false);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { error } = isSignUp
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            if (isSignUp) {
                setMessage({ type: 'success', text: 'Verifique seu e-mail para confirmar o cadastro!' });
            }
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0d1117] p-4 font-sans">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-2xl border border-slate-800 p-8 rounded-[2.5rem] shadow-3xl relative z-10 transition-all">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-teal-500 rounded-3xl flex items-center justify-center shadow-2xl mb-6 shadow-purple-500/20">
                        <IconPlane />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">SkyNav</h1>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.2em]">Navegação Aeronáutica</p>
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

                <div className="relative flex items-center justify-center my-6">
                    <div className="w-full h-px bg-slate-800"></div>
                    <span className="absolute px-4 bg-[#0d1117] text-[10px] font-black uppercase tracking-widest text-slate-600">Ou use e-mail</span>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#0d1117] border border-slate-700/50 rounded-2xl py-4 px-6 text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-700"
                            placeholder="seu@email.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#0d1117] border border-slate-700/50 rounded-2xl py-4 px-6 text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-slate-700"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl text-xs font-bold text-center ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
                    </button>
                </form>

                <div className="mt-8 text-center">
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
