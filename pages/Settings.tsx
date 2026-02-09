
import React, { useState, useEffect } from 'react';
import { Save, Key, Sheet, Smartphone, ShieldCheck, Mail, Check, Loader2, LogIn, ExternalLink, Battery, AlertTriangle, UserCircle, Briefcase, Globe, Cloud, UploadCloud, Database, Calendar, MessageCircle, Package, Plus, Trash2, Wand2, Zap, DollarSign, Calculator, TrendingUp, Image as ImageIcon, X, Bot, Server } from 'lucide-react';
import { sheetsService } from '../services/googleSheetsService';
import { firebaseService } from '../services/firebaseService';
import { storage } from '../services/storage';
import { UserProfile, PricingPackage } from '../types';
import { gamificationService } from '../services/gamificationService';
import { api } from '../services/api';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'persona' | 'pricing' | 'cloud'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');
  
  // Setup & Generation State
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isGeneratingPackages, setIsGeneratingPackages] = useState(false);
  const [generationParams, setGenerationParams] = useState({
      baseCost: 3000,
      margin: 50,
      serviceType: 'Web Tasarım'
  });
  
  const [usage, setUsage] = useState(storage.getUsage());

  // Initialize state with specific keys, falling back to generic 'apiKey' if specific ones aren't found (migration)
  const [settings, setSettings] = useState({
      clientId: localStorage.getItem('clientId') || '',
      geminiApiKey: localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey') || '',
      googleApiKey: localStorage.getItem('googleApiKey') || localStorage.getItem('apiKey') || '',
      sheetId: localStorage.getItem('sheetId') || '',
      waToken: localStorage.getItem('waToken') || '',
      waPhoneId: localStorage.getItem('waPhoneId') || '',
      adminPhone: localStorage.getItem('adminPhone') || '',
      dailyLimit: usage.dailyLimit,
      firebaseConfig: localStorage.getItem('firebaseConfig') || ''
  });

  const [profile, setProfile] = useState<UserProfile>(storage.getUserProfile());

  // Load profile from Firebase if available
  useEffect(() => {
      const fetchCloudProfile = async () => {
          if (firebaseService.isInitialized) {
              const cloudProfile = await firebaseService.getUserProfile();
              if (cloudProfile) {
                  setProfile(cloudProfile);
                  storage.saveUserProfile(cloudProfile); // Sync to local
              }
          }
      };
      fetchCloudProfile();
  }, [activeTab]);

  useEffect(() => {
    if (window.gapi?.client?.getToken()) {
        setIsAuthenticated(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // API Key ve Client ID gibi alanlarda boşlukları temizle
      const value = (e.target.name.includes('Key') || e.target.name === 'clientId' || e.target.name === 'sheetId') 
          ? e.target.value.trim() 
          : e.target.value;
      setSettings({ ...settings, [e.target.name]: value });
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setProfile({ ...profile, logo: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleGeneratePackages = async () => {
      setIsGeneratingPackages(true);
      try {
          const generatedPackages = await api.setup.generatePackages(
              generationParams.baseCost, 
              generationParams.margin, 
              generationParams.serviceType
          );
          setProfile({ ...profile, packages: generatedPackages });
          setSaveStatus('success');
          // Auto save
          storage.saveUserProfile({ ...profile, packages: generatedPackages });
          if (firebaseService.isInitialized) {
              await firebaseService.saveUserProfile({ ...profile, packages: generatedPackages });
          }
      } catch (error) {
          console.error("Package generation failed", error);
          alert("Paket oluşturulamadı. Lütfen tekrar deneyin.");
      } finally {
          setIsGeneratingPackages(false);
      }
  };

  const removePackage = (index: number) => {
      if (!profile.packages) return;
      const newPackages = profile.packages.filter((_, i) => i !== index);
      setProfile({ ...profile, packages: newPackages });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');
    
    if (activeTab === 'general') {
        const cleanGeminiKey = settings.geminiApiKey.trim();
        const cleanGoogleKey = settings.googleApiKey.trim();
        const cleanClientId = settings.clientId.trim();

        // Save distinct keys
        localStorage.setItem('geminiApiKey', cleanGeminiKey);
        localStorage.setItem('googleApiKey', cleanGoogleKey);
        
        // Update legacy key for fallback compatibility
        localStorage.setItem('apiKey', cleanGeminiKey); 

        localStorage.setItem('clientId', cleanClientId);
        localStorage.setItem('sheetId', settings.sheetId.trim());
        localStorage.setItem('waToken', settings.waToken);
        localStorage.setItem('waPhoneId', settings.waPhoneId);
        localStorage.setItem('adminPhone', settings.adminPhone);
        
        storage.updateLimit(Number(settings.dailyLimit));
        sheetsService.setSpreadsheetId(settings.sheetId);

        try {
            // Eğer Client ID varsa initialize et
            if (cleanClientId && cleanGoogleKey) {
                await sheetsService.initialize(cleanGoogleKey, cleanClientId);
            }
            setSaveStatus('success');
        } catch (e: any) {
            console.error(e);
            setSaveStatus('error');
            // Hata mesajını ayrıştır
            let msg = e.message;
            if (msg.includes("API key not valid")) {
                msg = "Google Cloud API Key geçersiz. Lütfen Google Cloud Console'dan kopyaladığınız anahtarı kontrol edin.";
            } else if (msg.includes("origin_mismatch")) {
                msg = "Yetkili Kaynak Hatası (Origin Mismatch). Client ID ayarlarında 'Authorized JavaScript origins' kısmına 'http://localhost:3000' eklediğinizden emin olun.";
            }
            setErrorMessage(msg || "Bağlantı hatası. API Key veya Client ID geçersiz.");
        }
    } else if (activeTab === 'cloud') {
        try {
            JSON.parse(settings.firebaseConfig);
            firebaseService.saveConfig(settings.firebaseConfig);
            setSaveStatus('success');
        } catch (e) {
            alert("Hatalı JSON formatı. Lütfen config objesini kontrol edin.");
        }
    } else {
        storage.saveUserProfile(profile);
        if (firebaseService.isInitialized) {
            await firebaseService.saveUserProfile(profile);
        }
        setSaveStatus('success');
    }
    
    setTimeout(() => {
        if (saveStatus !== 'error') setSaveStatus('idle');
    }, 3000);
    setIsSaving(false);
  };

  const handleGoogleLogin = async () => {
      setAuthLoading(true);
      try {
          await sheetsService.initialize(settings.googleApiKey.trim(), settings.clientId.trim());
          await sheetsService.handleAuthClick();
          setIsAuthenticated(true);
      } catch (error: any) {
          console.error("Login failed", error);
          alert(`Giriş başarısız: ${error.message || JSON.stringify(error)}`);
      } finally {
          setAuthLoading(false);
      }
  };

  const handleMigrateToCloud = async () => {
      if (!firebaseService.isInitialized) {
          alert("Önce Firebase bağlantısını yapmalısınız.");
          return;
      }
      
      if (!confirm("Yerel verileriniz (Leads, Görevler, Şablonlar, Profil vs.) Firebase veritabanına aktarılacak. Onaylıyor musunuz?")) return;

      setIsMigrating(true);
      setMigrationStatus('Hazırlanıyor...');

      try {
          const leads = storage.getLeads();
          const tasks = storage.getTasks();
          const templates = storage.getTemplates();
          const logs = storage.getLogs();
          const events = storage.getCalendarEvents();
          const userProfile = storage.getUserProfile();
          const userProgress = gamificationService.getProgress();

          setMigrationStatus(`Lead'ler yükleniyor (${leads.length})...`);
          for (const item of leads) { await firebaseService.addLead(item); }

          setMigrationStatus(`Görevler yükleniyor (${tasks.length})...`);
          for (const item of tasks) { await firebaseService.addTask(item); }

          setMigrationStatus(`Şablonlar yükleniyor (${templates.length})...`);
          for (const item of templates) { await firebaseService.saveTemplate(item); }

          setMigrationStatus(`Kayıtlar yükleniyor...`);
          for (const item of logs) { await firebaseService.logAction(item); }
          for (const item of events) { await firebaseService.addCalendarEvent(item); }

          setMigrationStatus(`Profil ve XP yükleniyor...`);
          await firebaseService.saveUserProfile(userProfile);
          await firebaseService.saveUserProgress(userProgress);

          setMigrationStatus('Tamamlandı!');
          alert("Tüm veriler başarıyla buluta aktarıldı!");

      } catch (error) {
          console.error(error);
          setMigrationStatus('Hata oluştu!');
          alert("Aktarım sırasında bir hata oluştu. Konsolu kontrol edin.");
      } finally {
          setIsMigrating(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-xl font-semibold text-slate-900">Ayarlar</h2>
            <p className="text-slate-500 mt-1">Sistem, entegrasyon ve kimlik ayarları.</p>
        </div>
        <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
            <button onClick={() => setActiveTab('general')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'general' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}>Genel & API</button>
            <button onClick={() => setActiveTab('cloud')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'cloud' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}><Cloud size={16} /> Bulut</button>
            <button onClick={() => setActiveTab('persona')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'persona' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}><UserCircle size={16} /> Persona</button>
            <button onClick={() => setActiveTab('pricing')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'pricing' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}><DollarSign size={16} /> Fiyatlandırma</button>
        </div>
      </div>

      {activeTab === 'pricing' ? (
          <div className="space-y-8">
              {/* Pricing Content (No changes needed here) */}
              <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 opacity-20 blur-3xl -ml-10 -mb-10"></div>
                  <div className="relative z-10">
                      <h3 className="text-xl font-bold flex items-center gap-2 mb-2"><Wand2 className="text-yellow-300" /> AI Paket Oluşturucu</h3>
                      <p className="text-indigo-200 text-sm mb-6 max-w-xl">Maliyet ve kar hedefinizi girin, AI sizin için paketleri oluştursun.</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                              <label className="text-xs font-bold text-indigo-300 uppercase block mb-2">Minimum Maliyet (TL)</label>
                              <div className="flex items-center gap-2"><Calculator size={16} className="text-white opacity-50" /><input type="number" value={generationParams.baseCost} onChange={(e) => setGenerationParams({...generationParams, baseCost: Number(e.target.value)})} className="bg-transparent border-b border-white/30 text-white font-mono font-bold w-full outline-none focus:border-yellow-400"/></div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                              <label className="text-xs font-bold text-indigo-300 uppercase block mb-2">Hedef Kâr Marjı (%)</label>
                              <div className="flex items-center gap-2"><TrendingUp size={16} className="text-white opacity-50" /><input type="number" value={generationParams.margin} onChange={(e) => setGenerationParams({...generationParams, margin: Number(e.target.value)})} className="bg-transparent border-b border-white/30 text-white font-mono font-bold w-full outline-none focus:border-yellow-400"/></div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                              <label className="text-xs font-bold text-indigo-300 uppercase block mb-2">Hizmet Türü</label>
                              <select value={generationParams.serviceType} onChange={(e) => setGenerationParams({...generationParams, serviceType: e.target.value})} className="bg-transparent border-b border-white/30 text-white w-full outline-none focus:border-yellow-400 text-sm font-medium">
                                  <option className="text-slate-900" value="Web Tasarım">Web Tasarım</option>
                                  <option className="text-slate-900" value="SEO & Dijital Pazarlama">SEO & Pazarlama</option>
                                  <option className="text-slate-900" value="Sosyal Medya Yönetimi">Sosyal Medya</option>
                              </select>
                          </div>
                      </div>
                      <button onClick={handleGeneratePackages} disabled={isGeneratingPackages} className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-indigo-900 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                          {isGeneratingPackages ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                          {isGeneratingPackages ? 'Paketler Hesaplanıyor...' : 'Otomatik Paketleri Oluştur'}
                      </button>
                  </div>
              </div>
              {profile.packages && profile.packages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {profile.packages.map((pkg, idx) => {
                          const profit = pkg.profit || (pkg.price - (pkg.cost || 0));
                          const margin = pkg.price > 0 ? Math.round((profit / pkg.price) * 100) : 0;
                          return (
                              <div key={pkg.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all relative group overflow-hidden flex flex-col">
                                  <div className={`h-2 w-full ${idx === 0 ? 'bg-slate-400' : idx === 1 ? 'bg-indigo-500' : 'bg-purple-600'}`}></div>
                                  <div className="p-6 flex-1 flex flex-col">
                                      <div className="flex justify-between items-start mb-4">
                                          <h4 className="font-bold text-lg text-slate-900">{pkg.name}</h4>
                                          <button onClick={() => removePackage(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                      <div className="mb-6 space-y-2">
                                          <div className="flex justify-between items-end"><span className="text-sm text-slate-500">Satış Fiyatı</span><span className="text-2xl font-bold text-slate-800">{pkg.price.toLocaleString()} ₺</span></div>
                                          <div className="flex justify-between items-end text-xs text-slate-400"><span>Maliyet</span><span>{pkg.cost?.toLocaleString() || 0} ₺</span></div>
                                          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center"><span className="text-xs font-bold text-green-600 uppercase">Net Kâr</span><div className="text-right"><span className="block font-bold text-green-600">{profit.toLocaleString()} ₺</span><span className="text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded ml-auto w-fit">%{margin} Marj</span></div></div>
                                      </div>
                                      <div className="bg-slate-50 rounded-lg p-4 flex-1">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1"><Check size={12} /> Özellikler</h5>
                                          <ul className="space-y-2">{pkg.features.slice(0, 5).map((feat, i) => (<li key={i} className="text-xs text-slate-600 flex items-start gap-2"><span className="w-1 h-1 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0"></span>{feat}</li>))}{pkg.features.length > 5 && (<li className="text-[10px] text-slate-400 italic">ve {pkg.features.length - 5} özellik daha...</li>)}</ul>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"><Package size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500">Henüz paket oluşturulmadı. Yukarıdaki "AI Paket Oluşturucu"yu kullanın.</p></div>
              )}
          </div>
      ) : activeTab === 'cloud' ? (
          <div className="space-y-6">
              {/* Cloud Content */}
              <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-6 bg-gradient-to-r from-white to-orange-50">
                  <div className="flex items-start gap-4">
                      <div className="p-3 bg-orange-100 rounded-full text-orange-600"><Cloud size={32} /></div>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900">Firebase Bulut Senkronizasyonu</h3>
                          <p className="text-sm text-slate-600 mb-4">Verilerinizi Google'ın Firebase altyapısında saklayın.</p>
                          <div className="space-y-4">
                              <div>
                                  <label className="text-sm font-medium text-slate-700 block mb-2">Firebase Config JSON</label>
                                  <textarea name="firebaseConfig" value={settings.firebaseConfig} onChange={handleChange} rows={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs" placeholder='{ "apiKey": "...", "authDomain": "...", ... }'/>
                              </div>
                              {firebaseService.isInitialized ? (<div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200"><div className="flex items-center gap-2 text-green-700 font-bold"><Check size={18} /> Bağlantı Aktif</div></div>) : (<div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm"><AlertTriangle size={16} /> Bağlantı bekleniyor...</div>)}
                          </div>
                      </div>
                  </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Database size={24} /></div>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900">Veri Göçü (Migration)</h3>
                          <p className="text-sm text-slate-600 mb-4">Yerel verilerinizi Firebase'e aktarın.</p>
                          <button onClick={handleMigrateToCloud} disabled={isMigrating || !firebaseService.isInitialized} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isMigrating ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} {isMigrating ? 'Aktarılıyor...' : 'Yerel Verileri Buluta Yükle'}</button>
                          {migrationStatus && (<p className="text-xs text-slate-500 mt-2 font-medium animate-pulse">{migrationStatus}</p>)}
                      </div>
                  </div>
              </div>
          </div>
      ) : activeTab === 'persona' ? (
          <div className="space-y-6">
              {/* Persona Content */}
              <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-6 bg-gradient-to-r from-white to-indigo-50">
                  <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-100 rounded-full text-indigo-600"><UserCircle size={32} /></div>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900">Ajan Kimliği (Persona)</h3>
                          <p className="text-sm text-slate-600 mb-4">Ajanın sizin yerinize mail atarken kullanacağı kimlik ve imza bilgileri.</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Profil Fotoğrafı / Logo</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {profile.logo ? (
                                                <img src={profile.logo} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={24} className="text-slate-400" />
                                            )}
                                        </div>
                                        <label className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                                            Yükle
                                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                        </label>
                                        {profile.logo && (
                                            <button onClick={() => setProfile({...profile, logo: undefined})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700">Adınız Soyadınız</label><input type="text" name="fullName" value={profile.fullName} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700">Unvanınız</label><input type="text" name="role" value={profile.role} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Briefcase size={14}/> Şirket Adı</label><input type="text" name="companyName" value={profile.companyName} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Globe size={14}/> Web Sitesi</label><input type="text" name="website" value={profile.website} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Mail size={14}/> E-posta</label><input type="email" name="email" value={profile.email} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Smartphone size={14}/> Telefon</label><input type="text" name="phone" value={profile.phone} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"/></div>
                                <div className="space-y-2"><label className="text-sm font-medium text-slate-700">İletişim Tonu</label><select name="tone" value={profile.tone} onChange={handleProfileChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"><option value="Profesyonel">Profesyonel & Kurumsal</option><option value="Samimi">Samimi & Arkadaş canlısı</option><option value="Heyecanlı">Enerjik & Heyecanlı</option><option value="Minimalist">Kısa & Öz (Minimalist)</option></select></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Email Signature Preview */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Mail size={18} className="text-indigo-600"/> E-Posta İmzası Önizlemesi</h3>
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-4">
                          {profile.logo ? (
                              <img src={profile.logo} alt="Signature Logo" className="w-16 h-16 rounded-full object-cover border border-slate-300" />
                          ) : (
                              <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">
                                  {profile.fullName.charAt(0)}
                              </div>
                          )}
                          <div>
                              <div className="font-bold text-slate-900 text-lg">{profile.fullName}</div>
                              <div className="text-slate-600 text-sm">{profile.role} | {profile.companyName}</div>
                              <div className="flex gap-3 mt-1 text-xs text-indigo-600">
                                  <span>{profile.phone}</span>
                                  <span>•</span>
                                  <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline">{profile.website}</a>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
          // GENERAL TAB
          <div className="space-y-8">
            
            {/* GEMINI API KEY (SEPARATE FIELD) */}
            <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-6 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 mt-1"><Bot className="w-6 h-6" /></div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900">1. Yapay Zeka (Gemini)</h3>
                        <p className="text-sm text-slate-600 mb-4">Ajanın zekası için gerekli AI Studio anahtarı.</p>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Gemini API Key (AI Studio)</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="password" 
                                    name="geminiApiKey" 
                                    value={settings.geminiApiKey} 
                                    onChange={handleChange} 
                                    placeholder="AIzaSy... (Gemini Anahtarı)" 
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono" 
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Bu anahtar <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline">Google AI Studio</a>'dan alınır. Sadece AI işlemleri (sohbet, analiz, görsel) için kullanılır.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* GOOGLE CLOUD INTEGRATION */}
            <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-6 ${isAuthenticated ? 'border-green-200 bg-green-50/30' : ''}`}>
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 mt-1"><Server className="w-6 h-6" /></div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">2. Google Cloud Entegrasyonu</h3>
                                <p className="text-sm text-slate-500">Gmail, Takvim ve Sheets entegrasyonu için (Opsiyonel).</p>
                            </div>
                            {isAuthenticated && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Check size={12}/> Bağlı</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Google Cloud API Key</label>
                                <input 
                                    type="password" 
                                    name="googleApiKey" 
                                    value={settings.googleApiKey} 
                                    onChange={handleChange} 
                                    placeholder="AIzaSy... (Cloud Anahtarı)" 
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Client ID (OAuth 2.0)</label>
                                <input 
                                    type="text" 
                                    name="clientId" 
                                    value={settings.clientId} 
                                    onChange={handleChange} 
                                    placeholder="....apps.googleusercontent.com" 
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono" 
                                />
                            </div>
                        </div>
                        
                        <div className="mt-4">
                            {!isAuthenticated ? (
                                <button onClick={handleGoogleLogin} disabled={authLoading || !settings.clientId} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {authLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Google Hesabını Bağla
                                </button>
                            ) : (
                                <p className="text-xs text-green-600 font-medium">Hesabınız başarıyla bağlandı. Tüm servisler aktif.</p>
                            )}
                        </div>

                        {errorMessage && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700 flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <div className="break-all">{errorMessage}</div>
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                            Not: Cloud API Key ve Client ID, <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a>'dan alınır.
                        </p>
                    </div>
                </div>
            </div>

            {/* COST GUARD */}
            <div className="bg-white border border-orange-200 rounded-xl shadow-sm p-6 bg-gradient-to-r from-white to-orange-50">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600 mt-1"><ShieldCheck className="w-6 h-6" /></div>
                    <div className="flex-1"><h3 className="text-lg font-bold text-slate-900">Maliyet Koruması</h3><p className="text-sm text-slate-600 mb-4">Günlük API işlem sınırı.</p><div className="flex gap-4 items-center"><input type="range" min="10" max="500" step="10" name="dailyLimit" value={settings.dailyLimit} onChange={(e) => setSettings({...settings, dailyLimit: Number(e.target.value)})} className="flex-1 accent-orange-500 cursor-pointer"/><span className="font-bold text-slate-800">{settings.dailyLimit}</span></div></div>
                </div>
            </div>
          </div>
      )}

      <div className="flex justify-end pt-4 gap-3 items-center sticky bottom-0 bg-slate-50 p-4 border-t border-slate-200 -mx-6 -mb-12">
        {saveStatus === 'success' && (<span className="text-green-600 flex items-center gap-2 text-sm font-medium animate-fade-in"><Check size={16} /> Kaydedildi</span>)}
        {saveStatus === 'error' && (<span className="text-red-600 flex items-center gap-2 text-sm font-medium animate-fade-in"><X size={16} /> Hata Oluştu</span>)}
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>
    </div>
  );
};

export default Settings;
