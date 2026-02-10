import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mail, Lock, ArrowRight, Loader2, Database, ShieldCheck, Github, Zap } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import { storage } from '../services/storage';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        if (!firebaseService.isInitialized) {
            throw new Error("Firebase yapılandırması bulunamadı. Lütfen 'Yerel Mod' butonunu kullanın veya Ayarlar sayfasından Firebase bilgilerini girin.");
        }

        if (mode === 'login') {
            await firebaseService.login(email, password);
        } else {
            await firebaseService.register(email, password);
        }
        
        try {
            const cloudProfile = await firebaseService.getUserProfile();
            if (cloudProfile && cloudProfile.isSetupComplete) {
                storage.saveUserProfile(cloudProfile);
                
                const cloudProgress = await firebaseService.getUserProgress();
                if (cloudProgress) {
                    localStorage.setItem('sales_agent_gamification', JSON.stringify(cloudProgress));
                }
            }
        } catch (syncError) {
            console.warn("Could not sync profile from cloud:", syncError);
        }

        localStorage.setItem('isAuthenticated', 'true');
        navigate('/');
    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
            setError("E-posta veya şifre hatalı.");
        } else if (err.code === 'auth/email-already-in-use') {
            setError("Bu e-posta adresi zaten kullanımda.");
        } else {
            setError(err.message || "Bir hata oluştu.");
        }
    } finally {
        setLoading(false);
    }
  };

  const handleLocalMode = () => {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('localMode', 'true');
      navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        <div className="md:w-1/2 bg-gradient-to-br from-slate-900 to-indigo-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10 animate-pulse delay-700"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <Bot size={32} className="text-white" />
                    </div>
                    <span className="font-bold text-2xl tracking-tight">AI Sales Agent</span>
                </div>
                <h1 className="text-4xl font-bold leading-tight mb-6">
                    Satış Operasyonunuzu <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Otopilota Bağlayın.</span>
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed">
                    Yapay zeka destekli lead keşfi, otomatik e-posta pazarlaması ve akıllı takvim yönetimi ile işinizi büyütün.
                </p>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-4 mt-12">
                <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                    <Zap className="text-yellow-400 mb-2" size={24} />
                    <h3 className="font-bold">Hızlı Kurulum</h3>
                    <p className="text-xs text-slate-400">Dakikalar içinde başlayın.</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                    <ShieldCheck className="text-green-400 mb-2" size={24} />
                    <h3 className="font-bold">Güvenli Veri</h3>
                    <p className="text-xs text-slate-400">Firebase ile bulutta saklayın.</p>
                </div>
            </div>
        </div>

        <div className="md:w-1/2 p-12 flex flex-col justify-center bg-white">
            <div className="max-w-md mx-auto w-full">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {mode === 'login' ? 'Tekrar Hoşgeldiniz' : 'Hesap Oluşturun'}
                </h2>
                <p className="text-slate-500 mb-8">
                    {mode === 'login' ? 'Devam etmek için giriş yapın.' : 'Satış gücünüzü artırmaya bugün başlayın.'}
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2">
                        <div className="mt-0.5"><Lock size={16} /></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="ornek@sirket.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                        {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-600">
                        {mode === 'login' ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}
                        <button 
                            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                            className="ml-2 font-bold text-indigo-600 hover:underline"
                        >
                            {mode === 'login' ? "Kayıt Olun" : "Giriş Yapın"}
                        </button>
                    </p>
                </div>

                <div className="my-8 flex items-center gap-4">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-xs text-slate-400 font-medium uppercase">veya</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <button 
                    onClick={handleLocalMode}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Database size={18} className="text-slate-500" />
                    Yerel Mod ile Devam Et
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                    Yerel modda veriler sadece bu tarayıcıda saklanır. Firebase bağlantısı gerektirmez.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
