import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, UserCircle, Briefcase, Zap, Check, ArrowRight, Loader2, Key, Cloud, Database, Image as ImageIcon, Wand2, Plus } from 'lucide-react';
import { storage } from '../services/storage';
import { firebaseService } from '../services/firebaseService';
import { api } from '../services/api';
import { UserProfile } from '../types';

const STEPS = ['Sistem', 'Kimlik', 'Strateji', 'Oluşturuluyor'];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
      // API
      apiKey: process.env.API_KEY || localStorage.getItem('apiKey') || '',
      firebaseConfig: localStorage.getItem('firebaseConfig') || '',
      // Profile
      fullName: '',
      companyName: '',
      role: '',
      website: '',
      phone: '',
      email: '',
      logo: '',
      // Strategy
      serviceType: 'Web Tasarım',
      baseCost: 3000,
      margin: 50
  });

  const handleChange = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              handleChange('logo', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Step Actions ---

  const validateStep1 = () => {
      if (!formData.apiKey) {
          alert("Devam etmek için Gemini API Anahtarı zorunludur.");
          return false;
      }
      localStorage.setItem('apiKey', formData.apiKey);
      if (formData.firebaseConfig) {
          try {
              JSON.parse(formData.firebaseConfig);
              localStorage.setItem('firebaseConfig', formData.firebaseConfig);
              firebaseService.initialize(); // Try to connect
          } catch (e) {
              alert("Firebase Config JSON formatı hatalı.");
              return false;
          }
      }
      return true;
  };

  const validateStep2 = () => {
      if (!formData.fullName || !formData.companyName) {
          alert("Adınız ve Şirket Adı zorunludur.");
          return false;
      }
      return true;
  };

  const handleFinalize = async () => {
      setLoading(true);
      setCurrentStep(3); // Move to generation screen
      
      const log = (msg: string) => setGenerationLogs(prev => [...prev, msg]);

      try {
          // 1. Clear Demo Data
          log("Eski demo verileri temizleniyor...");
          await new Promise(r => setTimeout(r, 800));
          storage.clearAllData();

          // 2. Save Profile
          log("Kurumsal kimlik kaydediliyor...");
          const profile: UserProfile = {
              fullName: formData.fullName,
              companyName: formData.companyName,
              role: formData.role,
              website: formData.website,
              phone: formData.phone,
              email: formData.email,
              logo: formData.logo,
              tone: 'Profesyonel',
              isSetupComplete: true
          };
          
          // Always save locally first
          storage.saveUserProfile(profile);

          // Try Cloud Sync (Safe Mode)
          if (firebaseService.isInitialized) {
              log("Bulut senkronizasyonu deneniyor...");
              try {
                  await firebaseService.saveUserProfile(profile);
              } catch (cloudError) {
                  console.warn("Cloud sync failed (ignoring for local setup):", cloudError);
                  log("Bulut uyarısı: Erişim izni yok, yerel devam ediliyor.");
              }
          }

          // 3. Generate Pricing Packages
          log("Yapay zeka fiyatlandırma stratejisi oluşturuyor...");
          const packages = await api.setup.generatePackages(formData.baseCost, formData.margin, formData.serviceType);
          const profileWithPackages = { ...profile, packages };
          
          storage.saveUserProfile(profileWithPackages);
          
          if (firebaseService.isInitialized) {
              try {
                  await firebaseService.saveUserProfile(profileWithPackages);
              } catch (e) { /* ignore auth errors during onboarding */ }
          }

          // 4. Generate Email Templates
          log("Soğuk satış e-posta taslakları yazılıyor...");
          const templates = await api.setup.generateInitialTemplates(packages);
          templates.forEach(t => storage.saveTemplate(t));
          
          if (firebaseService.isInitialized) {
              try {
                  for (const t of templates) await firebaseService.saveTemplate(t);
              } catch (e) { /* ignore */ }
          }

          // 5. Create First Calendar Event (Sample)
          log("Takvim yapılandırılıyor...");
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          await api.calendar.create({
              title: 'Strateji Planlama Toplantısı',
              start: tomorrow.toISOString().slice(0, 11) + '10:00:00',
              end: tomorrow.toISOString().slice(0, 11) + '11:00:00',
              description: 'AI Ajan kurulum sonrası ilk değerlendirme.',
              type: 'task'
          });

          log("Kurulum tamamlandı! Yönlendiriliyorsunuz...");
          await new Promise(r => setTimeout(r, 1500));
          
          window.location.reload(); // Force reload to clear any memory states and load dashboard

      } catch (error: any) {
          console.error(error);
          alert("Kurulum sırasında kritik hata: " + error.message);
          setLoading(false);
          setCurrentStep(2); // Go back
      }
  };

  const nextStep = () => {
      if (currentStep === 0 && !validateStep1()) return;
      if (currentStep === 1 && !validateStep2()) return;
      if (currentStep === 2) {
          handleFinalize();
          return;
      }
      setCurrentStep(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left Panel: Progress & Info */}
        <div className="md:w-1/3 bg-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-indigo-500 rounded-lg"><Rocket size={24} /></div>
                    <h1 className="text-xl font-bold tracking-tight">Kurulum Sihirbazı</h1>
                </div>
                
                <div className="space-y-6">
                    {STEPS.map((step, idx) => (
                        <div key={idx} className={`flex items-center gap-4 transition-all duration-300 ${idx === currentStep ? 'opacity-100 scale-105' : idx < currentStep ? 'opacity-50' : 'opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                                idx <= currentStep ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600 text-slate-400'
                            }`}>
                                {idx < currentStep ? <Check size={16} /> : idx + 1}
                            </div>
                            <span className="font-medium text-sm">{step}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative z-10 text-xs text-slate-400 mt-12">
                <p>Bu kurulum sadece bir kez yapılır. Tüm verileriniz güvenle saklanır.</p>
            </div>
        </div>

        {/* Right Panel: Form */}
        <div className="md:w-2/3 p-8 flex flex-col">
            <div className="flex-1">
                {currentStep === 0 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">Sistem Bağlantıları</h2>
                            <p className="text-slate-500">Yapay zeka ve bulut servislerini aktif edelim.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <Key size={16} className="text-indigo-600"/> Gemini API Anahtarı <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="password" 
                                    value={formData.apiKey}
                                    onChange={(e) => handleChange('apiKey', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="AI Studio anahtarınızı yapıştırın"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline">Anahtarı buradan alabilirsiniz.</a>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <Cloud size={16} className="text-orange-500"/> Firebase Yapılandırması (Opsiyonel)
                                </label>
                                <textarea 
                                    value={formData.firebaseConfig}
                                    onChange={(e) => handleChange('firebaseConfig', e.target.value)}
                                    rows={5}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs"
                                    placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
                                />
                                <p className="text-xs text-slate-400 mt-1">Verilerin kalıcı olması ve buluta yedeklenmesi için önerilir.</p>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">Kurumsal Kimlik</h2>
                            <p className="text-slate-500">Ajan bu kimliği kullanarak sizin adınıza konuşacak.</p>
                        </div>

                        <div className="flex items-center gap-6 mb-6">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                                    {formData.logo ? (
                                        <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={32} className="text-slate-400" />
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 shadow-md">
                                    <Plus size={14} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Adınız Soyadınız <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.fullName}
                                    onChange={(e) => handleChange('fullName', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                                    placeholder="Örn: Ahmet Yılmaz"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Şirket Adı <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.companyName}
                                    onChange={(e) => handleChange('companyName', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                                    placeholder="Örn: Yılmaz Dijital"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Unvan</label>
                                <input 
                                    type="text" 
                                    value={formData.role}
                                    onChange={(e) => handleChange('role', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                                    placeholder="Örn: Kurucu Ortak"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Web Sitesi</label>
                                <input 
                                    type="text" 
                                    value={formData.website}
                                    onChange={(e) => handleChange('website', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                                    placeholder="www.sirketiniz.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                                <input 
                                    type="text" 
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                                    placeholder="05XX..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">İş Modeli & Strateji</h2>
                            <p className="text-slate-500">Yapay zeka bu bilgilerle paketlerinizi ve tekliflerinizi hazırlayacak.</p>
                        </div>

                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 mb-6">
                            <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                <Zap size={18} /> Hangi hizmeti satıyorsunuz?
                            </h4>
                            <select 
                                value={formData.serviceType}
                                onChange={(e) => handleChange('serviceType', e.target.value)}
                                className="w-full p-3 bg-white border border-indigo-200 rounded-xl outline-none text-indigo-900 font-medium"
                            >
                                <option value="Web Tasarım">Web Tasarım & Geliştirme</option>
                                <option value="SEO Hizmeti">SEO & Arama Motoru Optimizasyonu</option>
                                <option value="Sosyal Medya">Sosyal Medya Yönetimi</option>
                                <option value="Google Ads">Google Ads Reklam Yönetimi</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Başlangıç Maliyetiniz (TL)</label>
                                <input 
                                    type="number" 
                                    value={formData.baseCost}
                                    onChange={(e) => handleChange('baseCost', Number(e.target.value))}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none font-mono font-bold"
                                />
                                <p className="text-xs text-slate-400 mt-1">Sunucu, emek, lisans vb.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Kâr Marjı (%)</label>
                                <input 
                                    type="number" 
                                    value={formData.margin}
                                    onChange={(e) => handleChange('margin', Number(e.target.value))}
                                    className="w-full p-3 border border-slate-300 rounded-xl outline-none font-mono font-bold"
                                />
                                <p className="text-xs text-slate-400 mt-1">Satış başına ne kadar kâr istiyorsunuz?</p>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                            <Wand2 size={64} className="text-indigo-600 relative z-10 animate-bounce" />
                        </div>
                        
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ajan Yapılandırılıyor...</h2>
                            <p className="text-slate-500">Lütfen bekleyin, yapay zeka sizin için strateji geliştiriyor.</p>
                        </div>

                        <div className="w-full max-w-md bg-slate-100 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-left space-y-2 border border-slate-200">
                            {generationLogs.map((log, i) => (
                                <div key={i} className="flex items-center gap-2 text-slate-600 animate-slide-in-right">
                                    <Check size={12} className="text-green-500" /> {log}
                                </div>
                            ))}
                            <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                <Loader2 size={12} className="animate-spin" /> İşlem sürüyor...
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            {currentStep < 3 && (
                <div className="flex justify-end pt-6 border-t border-slate-100 mt-auto">
                    <button 
                        onClick={nextStep}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
                    >
                        {currentStep === 2 ? 'Kurulumu Tamamla' : 'Devam Et'} <ArrowRight size={18} />
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;