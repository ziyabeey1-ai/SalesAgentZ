
import React, { useState } from 'react';
import { X, Search, MapPin, Building2, CheckSquare, Plus, Loader2, Globe, AlertCircle, LayoutTemplate, Instagram, Smartphone, ShieldCheck, Filter, Swords, Target, Zap } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { SECTORS, DISTRICTS, SYSTEM_PROMPT } from '../constants';
import { api } from '../services/api';
import { Lead } from '../types';

interface LeadDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsAdded: () => void;
}

interface DiscoveredLead {
  id: string;
  firma_adi: string;
  adres: string;
  telefon: string;
  email?: string;
  web_sitesi_durumu: 'Var' | 'Yok' | 'Kötü';
  firsat_nedeni: string;
  puan: string;
  yorum_sayisi: string;
  selected: boolean;
  kaynaklar?: string[]; 
  dogrulama_skoru?: number;
  instagram_url?: string;
  google_maps_url?: string;
  maps_dogrulandi?: boolean;
  instagram_dogrulandi?: boolean;
}

interface ValidationReport {
    totalFound: number;
    crossValidated: number;
    rejected: number;
    rejectReasons: string[];
}

type SearchMode = 'maps' | 'bad_site' | 'social' | 'validated' | 'competitor_gap' | 'trigger_event';

const LeadDiscoveryModal: React.FC<LeadDiscoveryModalProps> = ({ isOpen, onClose, onLeadsAdded }) => {
  const [sector, setSector] = useState(SECTORS[0]);
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [searchMode, setSearchMode] = useState<SearchMode>('maps');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [step, setStep] = useState<'criteria' | 'results'>('criteria');
  const [importing, setImporting] = useState(false);
  
  // Patch: New Filters
  const [requireInstagramProfile, setRequireInstagramProfile] = useState(false);
  const [requireGoogleMapsSource, setRequireGoogleMapsSource] = useState(true);

  const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

  const getSearchPrompt = () => {
      const baseInfo = `İstanbul, ${district} bölgesindeki "${sector}" sektöründe hizmet veren işletmeleri bul.`;
      const emailRule = `⚠️ KRİTİK: EMAIL ZORUNLUDUR (info@, iletisim@ vb). Email'i olmayanları listeye alma.`;

      const jsonFormat = `
        JSON ÇIKTI FORMATI:
        {
          "leads": [
            {
              "firma_adi": "...",
              "adres": "...",
              "telefon": "...",
              "email": "info@firma.com", 
              "web_sitesi_durumu": "Var/Yok/Kötü",
              "firsat_nedeni": "...",
              "puan": "4.5",
              "yorum_sayisi": "50",
              "competitor_insight": "Rakibi X firması Ads veriyor ama bu firma haritada bile yok.",
              "instagram_url": "https://www.instagram.com/firma",
              "google_maps_url": "https://maps.google.com/...",
              "maps_dogrulandi": true,
              "instagram_dogrulandi": false,
              "dogrulama_skoru": 87
            }
          ]
        }
      `;

      // Patch: Added Quality Rules
      const leadQualityRules = `
        KALİTE KURALLARI:
        - Email formatı gerçek ve kurumsal olmalı.
        - Telefon numarası mümkünse işletmenin aktif iletişim numarası olmalı.
        - maps_dogrulandi alanı, Google Maps kaynağı ile eşleştiyse true olmalı.
        - instagram_dogrulandi alanı, profil aktif ve firmayla ilişkiliyse true olmalı.
      `;

      const sourceRules = `
        KAYNAK ODAĞI:
        - Google Maps URL'si bulabilirsen google_maps_url doldur.
        - Instagram profili bulabilirsen instagram_url doldur.
        - requireGoogleMapsSource=${requireGoogleMapsSource ? 'true' : 'false'}
        - requireInstagramProfile=${requireInstagramProfile ? 'true' : 'false'}
        ${requireGoogleMapsSource ? '- KRİTİK: Google Maps kaynağı yoksa lead listeye girmez.' : ''}
        ${requireInstagramProfile ? '- KRİTİK: Instagram profili yoksa lead listeye girmez.' : ''}
      `;

      if (searchMode === 'competitor_gap') {
          return `
            SİSTEM ROLÜ: Rekabet Analisti & Dedektif.
            GÖREV: ${district} bölgesinde ${sector} sektöründe "PAZAR PAYI KAYBEDEN" firmaları bul.
            
            STRATEJİ (Adım Adım Düşün):
            1. Önce bu bölgenin en popüler, en iyi dijital varlığı olan liderini belirle (Örn: X Burger).
            2. Sonra, bu lidere rakip olmaya çalışan ama dijitalde çok zayıf (sitesi yok, yorumu az) olan 3-5 firmayı bul.
            3. BU FİRMALARIN KESİNLİKLE E-MAİLİ OLMALI.
            
            HEDEF PROFİL:
            - İyi yemek yapıyor/hizmet veriyor ama Google'da çıkmıyor.
            - Rakibi (Lider) "Online Randevu/Sipariş" alırken, bu firma sadece telefonla çalışıyor.
            - FOMO (Fırsatı Kaçırma Korkusu) yaratabileceğimiz adaylar.

            ÇIKTIDA "firsat_nedeni" kısmına şunu yaz: "Rakibi [Lider Firma] çok güçlü, bu firma dijitalde yok oluyor."
            ${emailRule}
            ${leadQualityRules}
            ${sourceRules}
            ${jsonFormat}
          `;
      } else if (searchMode === 'trigger_event') {
          return `
            SİSTEM ROLÜ: Pazar Fırsatları Analisti.
            GÖREV: ${sector}, ${district} bölgesinde son 6 ayda "Tetikleyici Olay" yaşayan firmaları bul.
            TETİKLEYİCİLER: Yeni Açılış, Tabelası Değişenler, "Devren Kiralık"tan yeni çıkanlar, Tadilat yapanlar.
            ${emailRule}
            ${leadQualityRules}
            ${sourceRules}
            ${jsonFormat}
          `;
      } else if (searchMode === 'validated') {
          return `
            SİSTEM ROLÜ: B2B Validasyon Uzmanı.
            GÖREV: ${district} bölgesinde ${sector} sektöründe 3 farklı kaynaktan (Maps, Instagram, Rehber) doğrulanan firmalar.
            ${emailRule}
            ${leadQualityRules}
            ${sourceRules}
            ${jsonFormat}
          `;
      } else {
          return `
            ${baseInfo}
            HEDEF: ${searchMode === 'bad_site' ? 'Web sitesi eski/hatalı olanlar' : 'Web sitesi hiç olmayanlar'}.
            ${emailRule}
            ${leadQualityRules}
            ${sourceRules}
            ${jsonFormat}
          `;
      }
  };

  // Patch: Validation Helpers
  const hasUsableInstagramProfile = (value?: string) => {
      if (!value) return false;
      const normalized = value.trim().toLowerCase();
      return normalized.includes('instagram.com/') && !normalized.includes('/reel/') && !normalized.includes('/p/');
  };

  const hasUsableMapsUrl = (value?: string) => {
      if (!value) return false;
      const normalized = value.trim().toLowerCase();
      return normalized.includes('maps.google') || normalized.includes('goo.gl/maps') || normalized.includes('g.page');
  };

  const calculateFinalValidationScore = (lead: any) => {
      let score = Number(lead.dogrulama_skoru || 0);
      if (Number.isNaN(score)) score = 0;

      if (lead.maps_dogrulandi || hasUsableMapsUrl(lead.google_maps_url)) score += 25;
      if (lead.instagram_dogrulandi || hasUsableInstagramProfile(lead.instagram_url)) score += 15;
      if (lead.email && lead.email.includes('@')) score += 20;
      if (lead.telefon) score += 10;

      return Math.max(0, Math.min(100, score));
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setResults([]);
    setValidationReport(null);

    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const prompt = getSearchPrompt();
        
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT + " Sadece JSON döndür. Yorum yapma.",
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json'
            }
        });
        
        const text = result.text || '';
        let data: any = [];
        
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            
            if (!Array.isArray(parsed) && parsed.leads) {
                data = parsed.leads;
                if (parsed.validationReport) setValidationReport(parsed.validationReport);
            } else {
                data = parsed;
            }
        } catch (e) {
            console.error("JSON Parse Error", e);
        }

        if (Array.isArray(data) && data.length > 0) {
            // Strict Filtering based on Patch checkboxes
            const validLeads = data.filter((item: any) => 
                item.email && 
                item.email.includes('@') && 
                !item.email.includes('null') &&
                !item.email.includes('ornek') &&
                (!requireGoogleMapsSource || item.maps_dogrulandi || hasUsableMapsUrl(item.google_maps_url)) &&
                (!requireInstagramProfile || item.instagram_dogrulandi || hasUsableInstagramProfile(item.instagram_url))
            );

            const mappedResults: DiscoveredLead[] = validLeads.map((item: any, index: number) => {
                let webStatus: 'Var' | 'Yok' | 'Kötü' = 'Yok';
                if (item.web_sitesi_durumu) webStatus = item.web_sitesi_durumu === 'Var' ? 'Var' : (item.web_sitesi_durumu === 'Kötü' ? 'Kötü' : 'Yok');
                
                let reason = item.firsat_nedeni || 'Keşfedildi';
                if (item.competitor_insight) reason = item.competitor_insight; // Use specialized insight

                return {
                    id: `disc-${index}-${Date.now()}`,
                    firma_adi: item.firma_adi || item.name || 'Bilinmiyor',
                    adres: item.adres || district,
                    telefon: item.telefon || '',
                    email: item.email,
                    web_sitesi_durumu: webStatus,
                    firsat_nedeni: reason,
                    puan: item.puan || '0',
                    yorum_sayisi: item.yorum_sayisi || '0',
                    kaynaklar: item.kaynaklar,
                    // Patch: Validation fields
                    dogrulama_skoru: calculateFinalValidationScore(item),
                    instagram_url: item.instagram_url,
                    google_maps_url: item.google_maps_url,
                    maps_dogrulandi: Boolean(item.maps_dogrulandi || hasUsableMapsUrl(item.google_maps_url)),
                    instagram_dogrulandi: Boolean(item.instagram_dogrulandi || hasUsableInstagramProfile(item.instagram_url)),
                    selected: true
                };
            });
            setResults(mappedResults);
            setStep('results');
            
            if (mappedResults.length === 0) {
                alert("Arama yapıldı ancak kriterlere (Email/Maps/Instagram) uyan firma bulunamadı. Lütfen filtreleri gevşetin.");
            }
        } else {
            alert("Sonuç bulunamadı.");
        }

    } catch (error) {
        console.error("Discovery Error", error);
        alert("Hata oluştu.");
    } finally {
        setIsSearching(false);
    }
  };

  const toggleSelection = (id: string) => {
      setResults(results.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleImport = async () => {
      const selectedLeads = results.filter(r => r.selected);
      if (selectedLeads.length === 0) return;

      setImporting(true);
      try {
          for (const item of selectedLeads) {
              const newLead: Lead = {
                  id: Math.random().toString(36).substr(2, 9),
                  firma_adi: item.firma_adi,
                  sektor: sector,
                  ilce: district,
                  adres: item.adres,
                  telefon: item.telefon,
                  email: item.email || '', 
                  kaynak: 'AI Asistan',
                  websitesi_var_mi: item.web_sitesi_durumu === 'Yok' ? 'Hayır' : 'Evet',
                  lead_durumu: 'aktif',
                  lead_skoru: item.web_sitesi_durumu === 'Kötü' ? 4 : (item.web_sitesi_durumu === 'Yok' ? 3 : 2),
                  eksik_alanlar: item.email ? (item.telefon ? [] : ['telefon']) : ['email'], 
                  son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                  // Patch: Improved notes with verification details
                  notlar: `[Otomatik Keşif]\nMod: ${searchMode}\nAnaliz: ${item.firsat_nedeni}\nDoğrulama Skoru: ${item.dogrulama_skoru || 0}/100\nMaps: ${item.google_maps_url || 'Yok'}\nInstagram: ${item.instagram_url || 'Yok'}`
              };
              
              if (item.email) newLead.lead_skoru += 1;
              if (searchMode === 'competitor_gap') {
                  newLead.digitalWeakness = "Rakibinin gerisinde";
                  newLead.lead_skoru = 5; // Priority high
              }

              await api.leads.create(newLead);
              await api.dashboard.logAction('Lead Keşfedildi', `${item.firma_adi}`, 'success');
          }
          
          onLeadsAdded();
          onClose();
          setTimeout(() => {
              setStep('criteria');
              setResults([]);
          }, 500);

      } catch (error) {
          console.error("Import failed", error);
          alert("İçe aktarma hatası.");
      } finally {
          setImporting(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg">
                 <Search size={20} className="text-white" />
             </div>
             <div>
                <h3 className="font-semibold text-lg">Akıllı Lead Madenciliği</h3>
                <p className="text-xs text-slate-300">Yapay zeka ile doğrulanmış (Email + Tel) veri taraması</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {step === 'criteria' ? (
                <div className="flex flex-col h-full space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <button 
                            onClick={() => setSearchMode('maps')}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${searchMode === 'maps' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                        >
                            <MapPin size={20} className={`mb-2 ${searchMode === 'maps' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-xs">Yeni & Sitesiz</h4>
                        </button>

                        <button 
                            onClick={() => setSearchMode('bad_site')}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${searchMode === 'bad_site' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                        >
                            <LayoutTemplate size={20} className={`mb-2 ${searchMode === 'bad_site' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-xs">Kötü Site</h4>
                        </button>

                        <button 
                            onClick={() => setSearchMode('validated')}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${searchMode === 'validated' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                        >
                            <ShieldCheck size={20} className={`mb-2 ${searchMode === 'validated' ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-xs">Çapraz Kontrol</h4>
                        </button>

                        <button 
                            onClick={() => setSearchMode('competitor_gap')}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${searchMode === 'competitor_gap' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-300' : 'border-slate-200 bg-white'}`}
                        >
                            <Target size={20} className={`mb-2 ${searchMode === 'competitor_gap' ? 'text-purple-600' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-xs">Rakip Analizi (FOMO)</h4>
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                        </button>

                        <button 
                            onClick={() => setSearchMode('trigger_event')}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${searchMode === 'trigger_event' ? 'border-orange-600 bg-orange-50' : 'border-slate-200 bg-white'}`}
                        >
                            <Zap size={20} className={`mb-2 ${searchMode === 'trigger_event' ? 'text-orange-600' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-xs">Fırsat Tetikleyici</h4>
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Bölge</label>
                                <select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sektör</label>
                                <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Patch: Checkbox Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={requireGoogleMapsSource}
                                    onChange={(e) => setRequireGoogleMapsSource(e.target.checked)}
                                    className="accent-indigo-600"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Google Maps kaynağı zorunlu</p>
                                    <p className="text-xs text-slate-500">Harita linki veya Maps doğrulama sinyali olmayan leadler elenir.</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={requireInstagramProfile}
                                    onChange={(e) => setRequireInstagramProfile(e.target.checked)}
                                    className="accent-indigo-600"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Instagram profili zorunlu</p>
                                    <p className="text-xs text-slate-500">Özellikle B2C sektörlerinde sosyal varlığı olan adaylara odaklanır.</p>
                                </div>
                            </label>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex gap-3 text-xs text-amber-800">
                            <AlertCircle size={20} className="flex-shrink-0" />
                            <div>
                                <strong>Kalite Filtresi Aktif:</strong> Sadece e-posta adresi doğrulanabilen firmalar listelenir.
                                {searchMode === 'competitor_gap' && <p className="mt-1 font-bold text-purple-700">Rakip Analizi Modu: Başarılı rakiplerin zayıf alternatiflerini bulur.</p>}
                            </div>
                        </div>

                        <button 
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg shadow-lg flex items-center justify-center gap-3 disabled:opacity-70"
                        >
                            {isSearching ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
                            {isSearching ? 'Nitelikli Tarama Yapılıyor...' : 'Kaliteli Lead Bul'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Bulunan Nitelikli Leadler</h3>
                        <button onClick={() => { setStep('criteria'); setResults([]); }} className="text-sm text-slate-500 hover:text-slate-800 underline">Yeni Arama</button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500">
                                <tr>
                                    <th className="px-6 py-4 w-12"><CheckSquare size={16} /></th>
                                    <th className="px-6 py-4">Firma</th>
                                    <th className="px-6 py-4">Fırsat / İçgörü</th>
                                    <th className="px-6 py-4">İletişim (Email)</th>
                                    {/* Patch: New Validation Column */}
                                    <th className="px-6 py-4">Doğrulama</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((item) => (
                                    <tr key={item.id} className={`hover:bg-slate-50 cursor-pointer ${item.selected ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleSelection(item.id)}>
                                        <td className="px-6 py-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                                {item.selected && <Plus size={14} />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{item.firma_adi}</div>
                                            <div className="text-xs text-slate-500">{item.adres}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-medium text-slate-700 bg-slate-100 p-2 rounded border border-slate-200 max-w-[250px]">
                                                {item.firsat_nedeni}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-indigo-600 font-mono text-xs">{item.email}</div>
                                            <div className="text-slate-500 text-xs">{item.telefon}</div>
                                        </td>
                                        {/* Patch: Badges Cell */}
                                        <td className="px-6 py-4 text-xs">
                                            <div className="font-bold text-slate-700">{item.dogrulama_skoru || 0}/100</div>
                                            <div className="mt-1 flex flex-col gap-1">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${item.maps_dogrulandi ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    Maps {item.maps_dogrulandi ? '✓' : '—'}
                                                </span>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${item.instagram_dogrulandi ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    Instagram {item.instagram_dogrulandi ? '✓' : '—'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        {step === 'results' && (
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center">
                <div className="text-sm text-slate-600"><span className="font-bold">{results.filter(r => r.selected).length}</span> seçim</div>
                <button onClick={handleImport} disabled={importing || results.filter(r => r.selected).length === 0} className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-70">
                    {importing ? 'Ekleniyor...' : 'Seçilenleri İçe Aktar'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default LeadDiscoveryModal;
