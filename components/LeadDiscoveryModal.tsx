
import React, { useState } from 'react';
import { X, Search, MapPin, Building2, CheckSquare, Plus, Loader2, Globe, AlertCircle, LayoutTemplate, Instagram, Smartphone, AlertTriangle } from 'lucide-react';
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
  web_sitesi_durumu: 'Var' | 'Yok' | 'Kötü';
  firsat_nedeni: string; // Why we picked this
  puan: string;
  yorum_sayisi: string;
  selected: boolean;
}

type SearchMode = 'maps' | 'bad_site' | 'social';

const LeadDiscoveryModal: React.FC<LeadDiscoveryModalProps> = ({ isOpen, onClose, onLeadsAdded }) => {
  const [sector, setSector] = useState(SECTORS[0]);
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [searchMode, setSearchMode] = useState<SearchMode>('maps');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredLead[]>([]);
  const [step, setStep] = useState<'criteria' | 'results'>('criteria');
  const [importing, setImporting] = useState(false);

  // Helper to get API Key
  const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

  const getSearchPrompt = () => {
      const baseInfo = `İstanbul, ${district} bölgesindeki "${sector}" sektöründe hizmet veren işletmeleri Google Search kullanarak bul.`;
      
      // KOBİ Filter Logic
      const smeFilter = `
        ÖNEMLİ FİLTRELEME KURALLARI (KOBİ ODAKLI):
        1. BÜYÜK FİRMALARI ELE: Starbucks, Burger King, Acıbadem, Remax, Migros gibi büyük zincirleri, franchise şubeleri ve kurumsal holdingleri LİSTEYE ALMA.
        2. KÜÇÜK/ORTA İŞLETMELERİ SEÇ: Butik kafeler, yerel diş hekimleri, mahalle emlakçıları, tek şubeli güzellik merkezleri gibi sahibine ulaşabileceğimiz işletmeleri bul.
        3. FİRMA BÜYÜKLÜĞÜ: Çalışan sayısı tahminen 1-50 arası olanlara odaklan.
      `;

      if (searchMode === 'bad_site') {
          return `
            ${baseInfo}
            
            ${smeFilter}

            HEDEF KİTLE: "DİJİTAL ENKAZLAR"
            Web sitesi OLAN ama sitesi şu sorunlardan birine sahip KOBİ'leri bul:
            1. Tasarımı çok eski veya profesyonel durmuyor.
            2. Mobil uyumlu görünmüyor.
            3. Hakkında "site açılmıyor", "bilgiler güncel değil" gibi şikayetler var.
            
            ÇIKTI FORMATI (JSON):
            [
              {
                "firma_adi": "...",
                "adres": "...",
                "telefon": "...",
                "web_sitesi_durumu": "Kötü",
                "firsat_nedeni": "Tasarım eski / Mobil uyumsuz / Butik işletme",
                "puan": "...",
                "yorum_sayisi": "..."
              }
            ]
          `;
      } else if (searchMode === 'social') {
          return `
            ${baseInfo}
            
            ${smeFilter}

            HEDEF KİTLE: "SOSYAL MEDYA YILDIZLARI"
            Popülerliği yüksek (Yorum sayısı fazla) ama kendine ait profesyonel bir web sitesi OLMAYAN yerel işletmeleri bul.
            Şu işletmelere odaklan:
            1. Web sitesi kısmında sadece "Linktree", "Instagram profili" olanlar.
            2. İletişim için sadece WhatsApp veya DM kullananlar.
            
            ÇIKTI FORMATI (JSON):
            [
              {
                "firma_adi": "...",
                "adres": "...",
                "telefon": "...",
                "web_sitesi_durumu": "Yok",
                "firsat_nedeni": "Sadece Instagram var / Site yok / Yerel popüler",
                "puan": "...",
                "yorum_sayisi": "..."
              }
            ]
          `;
      } else {
          // Default: Maps (New/No Site)
          return `
            ${baseInfo}
            
            ${smeFilter}

            HEDEF KİTLE: "YENİ & GÖRÜNMEZLER"
            1. Yeni açılmış veya popülerliği artan yerel işletmeleri bul.
            2. Web sitesi hiç olmayan esnaflara odaklan.
            
            ÇIKTI FORMATI (JSON):
            [
              {
                "firma_adi": "...",
                "adres": "...",
                "telefon": "...",
                "web_sitesi_durumu": "Yok",
                "firsat_nedeni": "Web sitesi yok / Yeni açıldı",
                "puan": "...",
                "yorum_sayisi": "..."
              }
            ]
          `;
      }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setResults([]);

    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        
        const prompt = getSearchPrompt();

        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT + " Sadece geçerli bir JSON dizisi döndür. Başka bir metin ekleme.",
                tools: [{ googleSearch: {} }] // Enable Google Search Grounding
            }
        });

        const text = result.text || '';
        
        // Robust JSON extraction: Find the first '[' and the last ']'
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        
        let data: any[] = [];
        
        if (start !== -1 && end !== -1) {
            const jsonStr = text.substring(start, end + 1);
            try {
                data = JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error", e);
                // Try aggressive cleanup if clean parse fails
                try {
                    const cleanStr = jsonStr.replace(/\\n/g, '').replace(/\\/g, '');
                    data = JSON.parse(cleanStr);
                } catch (e2) {
                    console.error("Aggressive Parse Error", e2);
                }
            }
        } else {
            console.warn("No JSON array found in response");
        }

        if (Array.isArray(data) && data.length > 0) {
            const mappedResults: DiscoveredLead[] = data.map((item: any, index: number) => ({
                id: `disc-${index}-${Date.now()}`,
                firma_adi: item.firma_adi || 'Bilinmiyor',
                adres: item.adres || district,
                telefon: item.telefon || '',
                web_sitesi_durumu: item.web_sitesi_durumu === 'Var' ? 'Var' : (item.web_sitesi_durumu === 'Kötü' ? 'Kötü' : 'Yok'),
                firsat_nedeni: item.firsat_nedeni || 'Potansiyel müşteri',
                puan: item.puan || '-',
                yorum_sayisi: item.yorum_sayisi || '0',
                selected: true // Auto-select all initially
            }));
            setResults(mappedResults);
            setStep('results');
        } else {
            alert("Arama sonucunda yapılandırılmış veri alınamadı. Lütfen tekrar deneyin.");
        }

    } catch (error) {
        console.error("Discovery Error", error);
        alert("Arama sırasında bir hata oluştu. API anahtarınızı kontrol edin.");
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
                  email: '', // Search usually doesn't return emails reliably
                  kaynak: 'Google Maps', // Simulated source
                  websitesi_var_mi: item.web_sitesi_durumu === 'Yok' ? 'Hayır' : 'Evet',
                  lead_durumu: 'aktif',
                  lead_skoru: item.web_sitesi_durumu === 'Kötü' ? 4 : (item.web_sitesi_durumu === 'Yok' ? 3 : 1), // Bad site is higher potential (they have money but bad tech)
                  eksik_alanlar: item.telefon ? ['email'] : ['email', 'telefon'],
                  son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                  notlar: `[Otomatik Keşif - ${searchMode === 'bad_site' ? 'Kötü Site' : searchMode === 'social' ? 'Sosyal Medya' : 'Yeni İşletme'}]\nFırsat Nedeni: ${item.firsat_nedeni}\nPuan: ${item.puan} (${item.yorum_sayisi} yorum)`
              };
              
              await api.leads.create(newLead);
              
              // Log action
              await api.dashboard.logAction('Lead Keşfedildi', `${item.firma_adi} (${item.firsat_nedeni})`, 'success');
          }
          
          onLeadsAdded();
          onClose();
          // Reset state for next time
          setTimeout(() => {
              setStep('criteria');
              setResults([]);
          }, 500);

      } catch (error) {
          console.error("Import failed", error);
          alert("İçe aktarma sırasında bir hata oluştu.");
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
                <h3 className="font-semibold text-lg">Lead Madenciliği</h3>
                <p className="text-xs text-slate-300">Yapay zeka destekli KOBİ taraması</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {step === 'criteria' ? (
                <div className="flex flex-col h-full space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button 
                            onClick={() => setSearchMode('maps')}
                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                                searchMode === 'maps' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                            }`}
                        >
                            <MapPin size={24} className={`mb-3 ${searchMode === 'maps' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <h4 className={`font-bold text-sm ${searchMode === 'maps' ? 'text-indigo-900' : 'text-slate-700'}`}>Yeni & Sitesiz</h4>
                            <p className="text-xs text-slate-500 mt-1">Büyük zincirler hariç, yeni açılan yerel işletmeler.</p>
                        </button>

                        <button 
                            onClick={() => setSearchMode('bad_site')}
                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                                searchMode === 'bad_site' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                            }`}
                        >
                            <LayoutTemplate size={24} className={`mb-3 ${searchMode === 'bad_site' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <h4 className={`font-bold text-sm ${searchMode === 'bad_site' ? 'text-indigo-900' : 'text-slate-700'}`}>Kötü Site Avı</h4>
                            <p className="text-xs text-slate-500 mt-1">Eski siteli KOBİ'ler (Yüksek dönüşüm).</p>
                            <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Favori</span>
                        </button>

                        <button 
                            onClick={() => setSearchMode('social')}
                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                                searchMode === 'social' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                            }`}
                        >
                            <Instagram size={24} className={`mb-3 ${searchMode === 'social' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <h4 className={`font-bold text-sm ${searchMode === 'social' ? 'text-indigo-900' : 'text-slate-700'}`}>Sosyal Medya</h4>
                            <p className="text-xs text-slate-500 mt-1">Popüler ama sadece Instagram kullanan butikler.</p>
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="font-semibold text-slate-800">Hedef Kitle Ayarları</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                    <MapPin size={16} className="text-indigo-600"/> Hedef Bölge
                                </label>
                                <select 
                                    value={district}
                                    onChange={(e) => setDistrict(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                >
                                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                    <Building2 size={16} className="text-indigo-600"/> Sektör
                                </label>
                                <select 
                                    value={sector}
                                    onChange={(e) => setSector(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                >
                                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-3 text-sm text-slate-600">
                            <Globe size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                            {searchMode === 'maps' && "Ajan, Google Haritalar'da web sitesi butonu olmayan yerel işletmeleri filtreler."}
                            {searchMode === 'bad_site' && "Ajan, web sitesi olan ancak tasarımı eski olan KOBİ'leri analiz eder."}
                            {searchMode === 'social' && "Ajan, yorum sayısı yüksek olan ancak sadece Instagram kullanan işletmeleri bulur."}
                        </div>

                        <button 
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSearching ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
                            {isSearching ? 'KOBİ Taraması Yapılıyor...' : 'Taramayı Başlat'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Tarama Sonuçları</h3>
                            <p className="text-sm text-slate-500">
                                <b>{district}</b> bölgesinde <b>{results.length}</b> potansiyel müşteri bulundu.
                            </p>
                        </div>
                        <button 
                            onClick={() => setStep('criteria')}
                            className="text-sm text-slate-500 hover:text-slate-800 underline"
                        >
                            Aramayı Değiştir
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4 w-12">
                                        <CheckSquare size={16} />
                                    </th>
                                    <th className="px-6 py-4">Firma Adı</th>
                                    <th className="px-6 py-4">Fırsat Nedeni</th>
                                    <th className="px-6 py-4">Puan</th>
                                    <th className="px-6 py-4">İletişim</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${item.selected ? 'bg-indigo-50/50' : ''}`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                item.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                                            }`}>
                                                {item.selected && <Plus size={14} />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{item.firma_adi}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.adres}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {item.web_sitesi_durumu === 'Kötü' ? (
                                                    <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                                        <LayoutTemplate size={14} />
                                                    </span>
                                                ) : searchMode === 'social' ? (
                                                    <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                        <Instagram size={14} />
                                                    </span>
                                                ) : (
                                                    <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                                        <AlertCircle size={14} />
                                                    </span>
                                                )}
                                                <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={item.firsat_nedeni}>
                                                    {item.firsat_nedeni}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm text-slate-700">
                                                <span className="font-bold text-amber-500">{item.puan}</span>
                                                <span className="text-slate-400 text-xs">({item.yorum_sayisi})</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {item.telefon || <span className="text-slate-400 italic">Bulunamadı</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        {step === 'results' && (
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="text-sm text-slate-600">
                    <span className="font-bold text-slate-900">{results.filter(r => r.selected).length}</span> işletme seçildi
                </div>
                <button 
                    onClick={handleImport}
                    disabled={importing || results.filter(r => r.selected).length === 0}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {importing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    {importing ? 'Ekleniyor...' : 'Seçilenleri Listeye Ekle'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default LeadDiscoveryModal;
