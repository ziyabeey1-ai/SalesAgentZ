
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { Lead, AgentConfig, AgentThought } from '../types';
import { GoogleGenAI } from "@google/genai";
import { SECTORS, DISTRICTS, SYSTEM_PROMPT } from '../constants';
import { storage } from '../services/storage';
import { firebaseService } from '../services/firebaseService';
import { gamificationService } from '../services/gamificationService';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: number;
}

interface AgentContextType {
  isAgentRunning: boolean;
  toggleAgent: () => void;
  agentStatus: string; 
  notifications: Notification[];
  thoughts: AgentThought[]; // New: Expose thoughts
  addNotification: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissNotification: (id: string) => void;
  runCycleNow: () => Promise<void>;
  dailyUsage: number;
  dailyLimit: number;
  pendingDraftsCount: number;
  agentConfig: AgentConfig;
  updateAgentConfig: (config: Partial<AgentConfig>) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);
const AGENT_MODEL = 'gemini-2.5-flash-preview';

// Helper to get API Key (Updated to prioritize geminiApiKey)
const getApiKey = () => {
    if (process.env.API_KEY) return process.env.API_KEY;
    const geminiKey = localStorage.getItem('geminiApiKey');
    if (geminiKey) return geminiKey;
    return localStorage.getItem('apiKey') || '';
};

// Reusable Robust JSON Parser
const parseGeminiJson = (text: string) => {
    const normalizeJsonText = (input: string) => {
        let clean = input.replace(/```json/g, '').replace(/```/g, '').trim();
        clean = clean.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        clean = clean.replace(/,\s*([}\]])/g, '$1');
        return clean;
    };

    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Extract from code blocks + normalization
        let clean = normalizeJsonText(text);
        try {
            return JSON.parse(clean);
        } catch (e2) {
            // 3. Replace single-quoted strings with double quotes (Risky but necessary fallback for bad LLM output)
            const withDoubleQuotes = clean.replace(/'([^']*)'/g, '"$1"');
            try {
                return JSON.parse(withDoubleQuotes);
            } catch (e3) {
                // 4. Regex extraction (Find first [ or { and last ] or })
                const match = withDoubleQuotes.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (match) {
                    try {
                        return JSON.parse(match[0]);
                    } catch (e4) {
                        throw new Error("JSON parse failed after regex extraction");
                    }
                }
                throw new Error("JSON parse failed: " + text.substring(0, 50) + "...");
            }
        }
    }
};

const extractGeminiText = (result: any) => {
    if (typeof result?.text === 'string') return result.text;
    const parts = result?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
        return parts.map((part: { text?: string }) => part.text || '').join('');
    }
    return '';
};

const getAiClient = () => {
    const apiKey = getApiKey().trim();
    if (!apiKey) {
        throw new Error('Gemini API anahtarı eksik. Ayarlar > Gemini API Key alanını doldurun.');
    }
    return new GoogleGenAI({ apiKey });
};

const formatAiError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();

    if (lower.includes('google search') || lower.includes('tool') || lower.includes('not supported')) {
        return 'Google Search aracı bu API anahtarında yetkili olmayabilir.';
    }
    if (lower.includes('model') && (lower.includes('not found') || lower.includes('not supported') || lower.includes('permission denied'))) {
        return `Seçilen model (${AGENT_MODEL}) erişilebilir değil. Ayarlar/testte çalışan modeli kullanın.`;
    }
    if (lower.includes('api key') || lower.includes('invalid_argument') || lower.includes('unauthenticated') || lower.includes('401')) {
        return 'API anahtarı geçersiz/eksik olabilir. Ayarlar > Gemini API Key alanını kontrol edin.';
    }
    if (lower.includes('quota') || lower.includes('429') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return 'Gemini kota/limit aşıldı. Birkaç dakika sonra tekrar deneyin.';
    }

    return raw;
};

export const AgentProvider = ({ children }: { children?: React.ReactNode }) => {
  const [isAgentRunning, setIsAgentRunning] = useState(false); 
  const [agentStatus, setAgentStatus] = useState<string>('Beklemede');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  
  // Agent Configuration
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
      targetDistrict: 'Tümü',
      targetSector: 'Tümü',
      focusMode: 'balanced'
  });

  // Usage Tracking state for UI
  const [usageStats, setUsageStats] = useState(storage.getUsage());
  
  const isRunningRef = useRef(isAgentRunning);
  const configRef = useRef(agentConfig);
  
  useEffect(() => {
      isRunningRef.current = isAgentRunning;
  }, [isAgentRunning]);

  useEffect(() => {
      configRef.current = agentConfig;
  }, [agentConfig]);

  const updateAgentConfig = (newConfig: Partial<AgentConfig>) => {
      setAgentConfig(prev => ({ ...prev, ...newConfig }));
      addThought('decision', `Yapılandırma güncellendi: ${JSON.stringify(newConfig)}`);
  };

  const checkPendingDrafts = async () => {
      try {
          const leads = await api.leads.getAll();
          const count = leads.filter(l => l.lead_durumu === 'onay_bekliyor').length;
          setPendingDraftsCount(count);
      } catch (error) {
          console.error("Error checking pending drafts:", error);
      }
  };

  // --- LOGGING HELPER ---
  const addThought = (type: AgentThought['type'], message: string, metadata?: any) => {
      const newThought: AgentThought = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit', second:'2-digit' }),
          type,
          message,
          metadata
      };
      setThoughts(prev => [newThought, ...prev].slice(0, 50)); // Keep last 50 thoughts
  };

  // --- HELPER: BUSINESS HOURS CHECK ---
  const isBusinessHours = () => {
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = now.getHours();
      
      // Work days (Mon-Fri) and Hours (09:00 - 18:00)
      const isWorkDay = day !== 0 && day !== 6;
      const isWorkHour = hour >= 9 && hour < 18;

      return isWorkDay && isWorkHour;
  };

  // Initial Startup Logic
  useEffect(() => {
      const init = async () => {
          await checkPendingDrafts();
          if (firebaseService.isInitialized) {
              try {
                  const cloudProfile = await firebaseService.getUserProfile();
                  if (cloudProfile) storage.saveUserProfile(cloudProfile);
                  const cloudProgress = await firebaseService.getUserProgress();
                  if (cloudProgress) gamificationService.saveProgress(cloudProgress);
                  addThought('info', 'Bulut verileri senkronize edildi.');
              } catch (e) {
                  console.error("Cloud hydration failed", e);
                  addThought('error', 'Bulut senkronizasyonu başarısız.');
              }
          }
      };
      init();
  }, []);

  const addNotification = useCallback((title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, title, message, type, timestamp: Date.now() }, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const toggleAgent = () => {
      const stats = storage.getUsage();
      if (!isAgentRunning && stats.aiCalls >= stats.dailyLimit) {
          addNotification('Limit Aşıldı', 'Günlük yapay zeka işlem limitine ulaşıldı.', 'warning');
          addThought('decision', 'Ajan başlatılamadı: Günlük limit dolu.');
          return;
      }
      setIsAgentRunning(prev => {
          const newState = !prev;
          setAgentStatus(newState ? 'Otopilot Başlatılıyor...' : 'Duraklatıldı');
          addThought(newState ? 'action' : 'decision', newState ? 'Otopilot devreye alındı.' : 'Otopilot manuel durduruldu.');
          return newState;
      });
  };

  const checkAndIncrementCost = (): boolean => {
      const stats = storage.getUsage();
      if (stats.aiCalls >= stats.dailyLimit) {
          setIsAgentRunning(false);
          setAgentStatus('Limit Aşıldı');
          addNotification('Güvenli Mod', 'Günlük bütçe limitine ulaşıldı. Ajan durduruldu.', 'warning');
          addThought('error', 'Güvenlik protokolü: Günlük bütçe limiti aşıldı. İşlemler durduruldu.');
          return false;
      }
      const newStats = storage.incrementUsage('ai');
      setUsageStats(newStats); 
      return true;
  };

  // --- AI WORKER FUNCTIONS ---

  const performAutoDiscovery = async () => {
      if (!checkAndIncrementCost()) return;

      const { targetDistrict, targetSector } = configRef.current;
      const districtToSearch = targetDistrict === 'Tümü' ? DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)] : targetDistrict;
      const sectorToSearch = targetSector === 'Tümü' ? SECTORS[Math.floor(Math.random() * SECTORS.length)] : targetSector;
      
      setAgentStatus(`${districtToSearch} bölgesinde ${sectorToSearch} taranıyor...`);
      addThought('action', `${districtToSearch} bölgesinde ${sectorToSearch} sektöründe yeni KOBİ taraması başlatıldı.`);
      
      try {
        const ai = getAiClient();
        
        const prompt = `
            GÖREV: İstanbul ${districtToSearch} bölgesinde "${sectorToSearch}" sektöründe hizmet veren, web sitesi olmayan veya yenilenmeye ihtiyacı olan 2 adet YEREL işletme bul.
            
            KURALLAR:
            1. Zincir marketleri, hastaneleri, kurumsal büyük firmaları ELE. Sadece esnaf/KOBİ bul.
            2. Kesinlikle JSON formatında döndür.
            
            JSON FORMATI: 
            [{ "firma_adi": "...", "adres": "..." }]
        `;

        let data: any[] = [];
        let primaryError: unknown = null;
        
        // Attempt 1: With Google Search (Preferred)
        try {
            const result = await ai.models.generateContent({
                model: AGENT_MODEL,
                contents: prompt,
                config: { 
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json' 
                }
            });
            data = parseGeminiJson(extractGeminiText(result) || '[]');
        } catch (error) {
            primaryError = error;
            // Attempt 2: Fallback (No Tools, No JSON enforcement for better compatibility)
            const fallbackPrompt = `${prompt}\n\nYANIT: SADECE JSON. Başka metin yazma.`;
            try {
                const fallbackResult = await ai.models.generateContent({
                    model: AGENT_MODEL,
                    contents: fallbackPrompt,
                    // Note: responseMimeType removed to avoid 400 errors on some models/keys
                });
                data = parseGeminiJson(extractGeminiText(fallbackResult) || '[]');
            } catch (fallbackError) {
                const primaryMessage = formatAiError(primaryError);
                const fallbackMessage = formatAiError(fallbackError);
                throw new Error(`Birincil keşif isteği başarısız: ${primaryMessage} | Fallback isteği başarısız: ${fallbackMessage}`);
            }
        }

        if (Array.isArray(data) && data.length > 0) {
            let addedCount = 0;
            const leads = await api.leads.getAll();
            
            for (const item of data) {
                if (!leads.find(l => l.firma_adi === item.firma_adi)) {
                    const newLead: Lead = {
                        id: Math.random().toString(36).substr(2, 9),
                        firma_adi: item.firma_adi,
                        sektor: sectorToSearch,
                        ilce: districtToSearch,
                        adres: item.adres || districtToSearch,
                        telefon: '',
                        email: '',
                        kaynak: 'Google Maps' as any,
                        websitesi_var_mi: 'Hayır',
                        lead_durumu: 'aktif',
                        lead_skoru: 1,
                        eksik_alanlar: ['email', 'telefon'],
                        son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                        notlar: 'Otopilot tarafından keşfedildi.'
                    };
                    await api.leads.create(newLead);
                    addedCount++;
                }
            }
            if (addedCount > 0) {
                await api.dashboard.logAction('Oto-Keşif', `${addedCount} yeni lead eklendi`, 'success');
                addThought('success', `${addedCount} yeni işletme veritabanına eklendi.`);
            } else {
                setAgentStatus('Yeni firma bulunamadı (Duplicate)');
                addThought('analysis', 'Bulunan firmalar zaten veritabanında mevcut.');
            }
        } else {
            addThought('warning', 'Arama yapıldı ancak uygun formatta veri dönmedi.');
        }
      } catch (e) { 
          console.error("Auto discovery failed", e);
          const message = formatAiError(e);
          addThought('error', `Keşif işlemi sırasında hata oluştu: ${message}`);
      }
  };

  const performAutoEnrichment = async (leads: Lead[]) => {
      const { targetDistrict, targetSector } = configRef.current;
      const candidates = leads.filter(l => 
          l.lead_durumu === 'aktif' && 
          (!l.email || !l.telefon) &&
          (targetDistrict === 'Tümü' || l.ilce === targetDistrict) &&
          (targetSector === 'Tümü' || l.sektor === targetSector)
      );

      const target = candidates[0];
      if (!target) return false;
      if (!checkAndIncrementCost()) return false;

      setAgentStatus(`${target.firma_adi} verileri zenginleştiriliyor...`);
      addThought('action', `${target.firma_adi} için iletişim bilgisi aranıyor.`);

      try {
          const ai = getAiClient();
          const prompt = `"${target.firma_adi}" (${target.ilce}, ${target.sektor}) için telefon ve e-posta bul. JSON: { "telefon": "...", "email": "..." }`;
          
          let textResult = "";
          try {
              const result = await ai.models.generateContent({
                model: AGENT_MODEL,
                contents: prompt,
                config: { 
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json' 
                }
              });
              textResult = extractGeminiText(result);
          } catch (searchError) {
              // Fallback
              const result = await ai.models.generateContent({
                  model: AGENT_MODEL,
                  contents: prompt + " (Tahmini veya simülasyon veri üret)"
              });
              textResult = extractGeminiText(result);
          }
          
          const data = parseGeminiJson(textResult || '{}');
          
          if (data.telefon || data.email) {
              const updatedLead = {
                  ...target,
                  telefon: target.telefon || data.telefon || '',
                  email: target.email || data.email || '',
                  eksik_alanlar: target.eksik_alanlar.filter(f => (data.email && f === 'email') ? false : (data.telefon && f === 'telefon') ? false : true)
              };
              updatedLead.lead_skoru += (data.email ? 2 : 0) + (data.telefon ? 1 : 0);
              await api.leads.update(updatedLead);
              addThought('success', `${target.firma_adi} verileri güncellendi: ${data.email ? 'Email' : ''} ${data.telefon ? 'Tel' : ''}`);
              return true;
          } else {
              addThought('analysis', `${target.firma_adi} için web'de yeni bilgi bulunamadı.`);
          }
      } catch (e) {
          console.error("Enrichment failed", e);
          const message = formatAiError(e);
          addThought('error', `${target.firma_adi} zenginleştirme başarısız: ${message}`);
      }
      return false;
  };

  const performAutoVisuals = async (leads: Lead[]) => {
      const candidates = leads.filter(l => 
          l.lead_durumu === 'aktif' &&
          l.email && 
          l.lead_skoru >= 2 && 
          !l.generatedHeroImage
      );

      const target = candidates[0];
      if (!target) return false;
      if (!checkAndIncrementCost()) return false;

      setAgentStatus(`${target.firma_adi} için görsel üretiliyor...`);
      addThought('action', `${target.firma_adi} için görsel vitrin tasarımı hazırlanıyor.`);

      try {
          const imageBase64 = await api.visuals.generateHeroImage(target);
          const updatedLead = { ...target, generatedHeroImage: imageBase64 };
          await api.leads.update(updatedLead);
          await api.dashboard.logAction('Oto-Görsel', `${target.firma_adi} vitrini hazırlandı.`, 'success');
          addThought('success', `${target.firma_adi} için görsel tasarım tamamlandı.`);
          return true;
      } catch (e) { 
          console.error("Auto visual failed", e); 
          addThought('error', 'Görsel üretimi başarısız oldu.');
      }
      return false;
  };

  const performAutoSocial = async (leads: Lead[]) => {
      const candidates = leads.filter(l => 
          l.lead_durumu === 'aktif' &&
          l.email &&
          l.lead_skoru >= 2 && 
          !l.instagramProfile
      );

      const target = candidates[0];
      if (!target) return false;
      if (!checkAndIncrementCost()) return false;

      setAgentStatus(`${target.firma_adi} sosyal medya analizi...`);
      addThought('action', `${target.firma_adi} Instagram profili analiz ediliyor.`);

      try {
          const result = await api.social.analyzeInstagram(target);
          const updatedLead = { ...target, instagramProfile: result };
          await api.leads.update(updatedLead);
          await api.dashboard.logAction('Oto-Sosyal', `${target.firma_adi} analiz edildi.`, 'success');
          addThought('success', `Instagram analizi tamamlandı: ${result.username}`);
          return true;
      } catch (e) { console.error("Auto social failed", e); }
      return false;
  };

  const performAutoOutreach = async (leads: Lead[]) => {
      if (!isBusinessHours()) {
          setAgentStatus('Mesai dışı (Beklemede...)');
          addThought('wait', 'Mesai saatleri dışında olduğum için mail gönderimini duraklattım.');
          return false;
      }

      const { targetDistrict, targetSector } = configRef.current;

      const readyLeads = leads.filter(l => 
          l.lead_durumu === 'aktif' && 
          l.email && 
          !l.son_kontakt_tarihi &&
          (targetDistrict === 'Tümü' || l.ilce === targetDistrict) &&
          (targetSector === 'Tümü' || l.sektor === targetSector)
      );

      // Prioritize leads with Visuals prepared
      const target = readyLeads.find(l => l.generatedHeroImage) || readyLeads[0];
      
      if (!target) return false;

      setAgentStatus(`${target.firma_adi} mail gönderiliyor...`);
      addThought('action', `${target.firma_adi} için mail gönderimi başlatıldı.`);

      try {
           let attachments: any[] = [];
           if (target.generatedHeroImage) {
               const base64Content = target.generatedHeroImage.split(',')[1];
               attachments.push({
                   filename: 'taslak_tasarim.png',
                   content: base64Content,
                   mimeType: 'image/png'
               });
           }

           let subject = `[${target.firma_adi}] Web Sitesi Taslağı Hazır 🎨`;
           let body = `Merhaba, ${target.firma_adi} için modern bir web sitesi demosu hazırladım.\n\nEkteki görseli inceleyebilir misiniz?\n\n`;
           
           if (target.instagramProfile?.suggestedDmOpener) {
               body = `${target.instagramProfile.suggestedDmOpener}\n\n` + body;
           }

           body += `Detayları konuşmak isterseniz bu maile dönebilirsiniz.\n\nSaygılarımla,\nAI Sales Agent`;

           await new Promise(r => setTimeout(r, 1500)); 
           await api.gmail.send(target.email, subject, body, attachments);
           
           const updatedLead = { 
              ...target, 
              lead_durumu: 'takipte' as any, 
              son_kontakt_tarihi: new Date().toISOString().slice(0, 10) 
           };
           await api.leads.update(updatedLead);
           
           const logMsg = target.generatedHeroImage ? 'Otopilot: Görsel İkna Maili' : 'Otopilot: Standart Mail';
           await api.leads.logInteraction(target.id, 'email', logMsg);
           await api.dashboard.logAction('Mail Gönderildi', `${target.firma_adi} (Görsel: ${!!target.generatedHeroImage})`, 'success');
           addThought('success', `${target.firma_adi} ile ilk temas kuruldu. (Takipte)`);
           return true;
      } catch (e) { 
          console.error("Outreach failed", e); 
          addThought('error', `${target.firma_adi} mail gönderimi başarısız.`);
      }
      return false;
  };

  const performAutoReplyDrafting = async (leads: Lead[]) => {
      const target = leads.find(l => 
          ['takipte', 'teklif_gonderildi'].includes(l.lead_durumu) && 
          !l.draftResponse && 
          Math.random() > 0.7 
      );

      if (!target) return false;
      if (!checkAndIncrementCost()) return false; 

      setAgentStatus(`${target.firma_adi} yanıtı analiz ediliyor...`);
      addThought('analysis', `${target.firma_adi} firmasından gelen sinyaller analiz ediliyor (Simülasyon).`);

      try {
          const ai = getAiClient();

          const simResult = await ai.models.generateContent({
              model: AGENT_MODEL,
              contents: `ROL: ${target.firma_adi} sahibi. DURUM: Mail aldın. GÖREV: 'Fiyat nedir?' veya 'Örnek var mı?' gibi kısa bir cevap yaz.`
          });
          const incomingMessage = extractGeminiText(simResult) || "Fiyat nedir?";

          const draftPrompt = `
            GÖREV: Müşteri yanıtını analiz et ve cevap taslağı oluştur.
            MÜŞTERİ: "${incomingMessage}"
            JSON: { "subject": "...", "body": "...", "intent": "..." }
          `;

          const result = await ai.models.generateContent({
              model: AGENT_MODEL,
              contents: draftPrompt,
              config: { responseMimeType: 'application/json' }
          });

          const data = parseGeminiJson(extractGeminiText(result) || '{}');

          const updatedLead: Lead = {
              ...target,
              lead_durumu: 'onay_bekliyor',
              draftResponse: {
                  subject: data.subject,
                  body: data.body,
                  intent: data.intent,
                  created_at: new Date().toISOString()
              },
              notlar: target.notlar ? `[Müşteri]: ${incomingMessage}\n\n${target.notlar}` : `[Müşteri]: ${incomingMessage}`
          };

          await api.leads.update(updatedLead);
          await api.dashboard.logAction('Oto-Yanıt Taslağı', `${target.firma_adi}`, 'info');
          addThought('decision', `${target.firma_adi} için yanıt taslağı oluşturuldu ve onaya sunuldu.`);
          setPendingDraftsCount(prev => prev + 1);
          return true;

      } catch (e) {
          console.error("Reply drafting failed", e);
          const message = formatAiError(e);
          addThought('error', `Yanıt taslağı üretilemedi: ${message}`);
      }
      return false;
  };

  const runCycleNow = async () => {
    if (!isRunningRef.current) {
        setAgentStatus('Duraklatıldı');
        return;
    }

    try {
      const leads = await api.leads.getAll();
      let actionTaken = false;

      // START LOGIC
      addThought('decision', 'Döngü başladı: Satış hunisi ve fırsatlar taranıyor.');

      // 1. Critical: Reply Drafts (Highest Priority)
      actionTaken = await performAutoReplyDrafting(leads);

      // 2. Preparation Phase: Generate Visuals & Social Analysis
      if (!actionTaken) {
          actionTaken = await performAutoVisuals(leads);
      }
      if (!actionTaken) {
          actionTaken = await performAutoSocial(leads);
      }

      // 3. Action Phase: Outreach & Enrichment
      if (!actionTaken) {
          const { targetDistrict, targetSector } = configRef.current;
          
          const relevantLeads = leads.filter(l => 
              (targetDistrict === 'Tümü' || l.ilce === targetDistrict) &&
              (targetSector === 'Tümü' || l.sektor === targetSector)
          );

          const activeLeads = relevantLeads.filter(l => l.lead_durumu === 'aktif');
          const readyToContact = activeLeads.filter(l => l.email && !l.son_kontakt_tarihi);
          const needsEnrichment = activeLeads.filter(l => !l.email);

          // Smart Strategy: Prefer Enrich -> Prepare Visuals -> Send Mail
          if (readyToContact.length > 0) {
              const visualReady = readyToContact.find(l => l.generatedHeroImage);
              
              if (visualReady) {
                  actionTaken = await performAutoOutreach(leads);
              } else {
                  if (readyToContact.length > 5) {
                      addThought('decision', 'Görsel bekleyen çok fazla lead birikti, standart mail gönderimine geçiliyor.');
                      actionTaken = await performAutoOutreach(leads);
                  } else {
                      addThought('wait', 'Lead var ancak henüz görsel hazır değil. Görsel üretimini bekliyorum.');
                  }
              }
          } 
          
          if (!actionTaken && needsEnrichment.length > 0) {
              addThought('decision', 'Eksik bilgili leadler tespit edildi. Zenginleştirme başlıyor.');
              actionTaken = await performAutoEnrichment(leads);
          } 
          
          if (!actionTaken && activeLeads.length < 5) {
              addThought('decision', 'Huni boşalıyor. Yeni lead keşfine çıkılıyor.');
              await performAutoDiscovery();
              actionTaken = true;
          }
      }
      
      await checkPendingDrafts();
      
      if (isRunningRef.current && !actionTaken) {
          if (!isBusinessHours()) {
              setAgentStatus('Mesai Dışı (Uyku Modu)');
              addThought('wait', 'Mesai saati dışında olduğum için uyku modundayım.');
          } else {
              setAgentStatus('Beklemede (İşlem aranıyor...)');
              addThought('wait', 'Yapılacak kritik bir işlem bulunamadı. Bir sonraki döngü bekleniyor.');
          }
      } 
      else if (isRunningRef.current) setTimeout(() => setAgentStatus('İzleniyor...'), 3000);

    } catch (error) {
      console.error("Agent cycle error", error);
      setAgentStatus('Hata');
      addThought('error', 'Kritik döngü hatası oluştu.');
    }
  };

  useEffect(() => {
    let interval: any;
    const tick = async () => {
        if (isRunningRef.current) await runCycleNow();
    };
    if (isAgentRunning) tick();
    interval = setInterval(tick, 20000);
    return () => clearInterval(interval);
  }, [isAgentRunning]);

  return (
    <AgentContext.Provider value={{
      isAgentRunning,
      toggleAgent,
      agentStatus,
      notifications,
      thoughts,
      addNotification,
      dismissNotification,
      runCycleNow,
      dailyUsage: usageStats.aiCalls,
      dailyLimit: usageStats.dailyLimit,
      pendingDraftsCount,
      agentConfig,
      updateAgentConfig
    }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
