import React, { useState } from 'react';
import { Save, Key, Sheet, Smartphone, ShieldCheck, Mail, Check, Loader2 } from 'lucide-react';

const Settings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const [settings, setSettings] = useState({
      clientId: '',
      clientSecret: '',
      sheetId: '',
      waToken: '',
      waPhoneId: '',
      geminiKey: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API delay
    setTimeout(() => {
        setIsSaving(false);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Ayarlar ve Entegrasyonlar</h2>
        <p className="text-slate-500 mt-1">API bağlantılarını ve ajan yapılandırmasını yönetin.</p>
      </div>

      {/* Google Integration */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-50 rounded-lg text-red-600 mt-1">
             <Mail className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-slate-900">Gmail & Sheets API</h3>
            <p className="text-sm text-slate-500 mb-4">Mail gönderimi ve veri kaydı için gerekli OAuth2 kimlik bilgileri.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Client ID</label>
                <input 
                    type="text" 
                    name="clientId"
                    value={settings.clientId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="xxxx-xxxx.apps.googleusercontent.com" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Client Secret</label>
                <input 
                    type="password" 
                    name="clientSecret"
                    value={settings.clientSecret}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="••••••••••••" 
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Google Sheet ID</label>
                <div className="flex gap-2">
                    <div className="flex items-center justify-center px-3 bg-slate-100 border border-slate-200 rounded-l-lg text-slate-500">
                        <Sheet size={16} />
                    </div>
                    <input 
                        type="text" 
                        name="sheetId"
                        value={settings.sheetId}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-r-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="1BxiMVs0XRA5nFMd..." 
                    />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

       {/* WhatsApp Integration */}
       <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-green-50 rounded-lg text-green-600 mt-1">
             <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-slate-900">WhatsApp Business API</h3>
            <p className="text-sm text-slate-500 mb-4">Ajan ile koordinasyon sağlamak için.</p>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Access Token</label>
                <div className="flex gap-2">
                    <div className="flex items-center justify-center px-3 bg-slate-100 border border-slate-200 rounded-l-lg text-slate-500">
                        <Key size={16} />
                    </div>
                    <input 
                        type="password" 
                        name="waToken"
                        value={settings.waToken}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-r-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="EAAG..." 
                    />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Phone Number ID</label>
                <input 
                    type="text" 
                    name="waPhoneId"
                    value={settings.waPhoneId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="100505..." 
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <ShieldCheck size={16} />
                <span>Webhook Durumu: Aktif (200 OK)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini API */}
       <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600 mt-1">
             <Key className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-slate-900">Gemini AI Configuration</h3>
            <p className="text-sm text-slate-500 mb-4">Agent zekası için Google GenAI API anahtarı.</p>
            
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">API Key</label>
                <input 
                    type="password" 
                    name="geminiKey"
                    value={settings.geminiKey}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="AIzaSy..." 
                />
                <p className="text-xs text-slate-400 mt-1">Bu anahtar yalnızca tarayıcı oturumunda saklanır.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 gap-3 items-center">
        {saveStatus === 'success' && (
            <span className="text-green-600 flex items-center gap-2 text-sm font-medium animate-fade-in">
                <Check size={16} /> Ayarlar kaydedildi
            </span>
        )}
        <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default Settings;