
import { Lead, DashboardStats, Task, ActionLog, Interaction, EmailTemplate, InteractionAnalysis, InteractionType, PricingPackage, MarketStrategyResult, StrategyResult, CompetitorAnalysis, InstagramAnalysis, UserProfile, LeadScoreDetails, PersonaAnalysis } from '../types';
import { sheetsService } from './googleSheetsService';
import { gmailService } from './gmailService';
import { whatsappService } from './whatsappService';
import { storage } from './storage';
import { gamificationService } from './gamificationService';
import { learningService } from './learningService';
import { GoogleGenAI, Modality } from "@google/genai";
import { decodeAudioData, playAudioBuffer, base64ToArrayBuffer } from '../utils/audioUtils';
import { SYSTEM_PROMPT } from '../constants';

const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const parseGeminiJson = (text: string) => {
    try {
        if (!text) return {};
        // Remove markdown code blocks
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Find the first '{' and last '}' to ensure we have a valid JSON object structure
        const firstBrace = clean.indexOf('{');
        const lastBrace = clean.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            clean = clean.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse Error (Recovered):", e);
        return {};
    }
};

const useSheets = () => {
    return sheetsService.isAuthenticated && localStorage.getItem('sheetId');
};

const canUseGoogleWorkspaceApis = () => {
    return sheetsService.isAuthenticated;
};

export const api = {
  // ... (leads, gmail, whatsapp modules unchanged)
  leads: {
    getAll: async (): Promise<Lead[]> => {
      if (useSheets()) return await sheetsService.getLeads();
      return storage.getLeads();
    },
    create: async (lead: Lead): Promise<Lead> => {
      gamificationService.recordAction('lead_add');
      const initialScore = lead.lead_skoru || 1;
      const boostedScore = learningService.applyWeights(initialScore, lead);
      const optimizedLead = { ...lead, lead_skoru: boostedScore };
      if (useSheets()) { await sheetsService.addLead(optimizedLead); return optimizedLead; }
      storage.saveLead(optimizedLead); return optimizedLead;
    },
    update: async (lead: Lead): Promise<void> => {
        const currentLeads = storage.getLeads();
        const oldLead = currentLeads.find(l => l.id === lead.id);
        if (oldLead && oldLead.lead_durumu !== lead.lead_durumu) {
            if (lead.lead_durumu === 'olumlu') {
                gamificationService.recordAction('deal_won');
                await learningService.learnFromOutcome(lead, 'won');
                await api.dashboard.logAction('AI Öğrenimi', `${lead.sektor} sektörü için başarı katsayısı artırıldı.`, 'success');
            } else if (lead.lead_durumu === 'olumsuz') {
                await learningService.learnFromOutcome(lead, 'lost');
                await api.dashboard.logAction('AI Öğrenimi', `${lead.sektor} sektörü için ağırlık düşürüldü.`, 'warning');
            }
        }
        if (useSheets()) { await sheetsService.updateLead(lead); } else { storage.updateLead(lead); }
    },
    logInteraction: async (leadId: string, type: InteractionType, summary?: string, analysis?: InteractionAnalysis): Promise<void> => {
        if (type === 'email') gamificationService.recordAction('email_sent');
        if (type === 'phone') gamificationService.recordAction('call_made');
        const interaction: Interaction = {
            id: Math.random().toString(36).substr(2, 9),
            leadId, type, direction: analysis ? 'inbound' : 'outbound',
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            summary: summary || 'Otomatik Etkileşim',
            status: analysis ? 'read' : 'sent',
            analysis
        };
        if (useSheets()) { await sheetsService.addInteraction(interaction); } else { storage.addInteraction(interaction); }
    },
    discover: async (sector: string, district: string): Promise<Lead[]> => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const prompt = `
            SİSTEM ROLÜ: Otonom Lead Avcısı.
            GÖREV: İstanbul, ${district} bölgesindeki "${sector}" sektöründe hizmet veren işletmeleri bul.
            
            KRİTERLER:
            1. Sadece EMAIL adresi olanları getir (info@, iletisim@ vb.). Email yoksa listeye alma.
            2. Web sitesi "Yok" veya "Eski" olanlara öncelik ver.
            3. En az 3 adet firma bul.

            JSON ÇIKTI FORMATI:
            {
              "leads": [
                {
                  "firma_adi": "...",
                  "adres": "...",
                  "telefon": "...",
                  "email": "...", 
                  "web_sitesi_durumu": "Var/Yok/Kötü",
                  "firsat_nedeni": "..."
                }
              ]
            }
        `;

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    systemInstruction: SYSTEM_PROMPT + " Sadece JSON döndür. Yorum yapma.",
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json'
                }
            });
            
            const data = parseGeminiJson(result.text || '{}');
            const foundLeads: Lead[] = [];

            if (data.leads && Array.isArray(data.leads)) {
                for (const item of data.leads) {
                    if (item.email && item.email.includes('@')) {
                        foundLeads.push({
                            id: Math.random().toString(36).substr(2, 9),
                            firma_adi: item.firma_adi || 'Bilinmiyor',
                            sektor: sector,
                            ilce: district,
                            adres: item.adres || district,
                            telefon: item.telefon || '',
                            email: item.email,
                            kaynak: 'AI Asistan',
                            websitesi_var_mi: item.web_sitesi_durumu === 'Yok' ? 'Hayır' : 'Evet',
                            lead_durumu: 'aktif',
                            lead_skoru: item.web_sitesi_durumu === 'Kötü' ? 4 : 3,
                            eksik_alanlar: [],
                            son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                            notlar: `[Otonom Keşif]: ${item.firsat_nedeni || 'Otomatik eklendi'}`
                        });
                    }
                }
            }
            return foundLeads;
        } catch (e) {
            console.error("Auto Discovery Failed", e);
            return [];
        }
    }
  },
  // ... (rest of the file remains similar but ensure parseGeminiJson is used consistently)
  gmail: {
      send: async (to: string, subject: string, body: string, attachments?: any[]) => {
          gamificationService.recordAction('email_sent');
          if (canUseGoogleWorkspaceApis()) return await gmailService.sendEmail(to, subject, body, attachments);
          await new Promise(resolve => setTimeout(resolve, 800));
          return { id: 'local-mock-id' };
      }
  },
  whatsapp: {
      sendReport: async (stats: DashboardStats, hotLeads: Lead[]) => {
          return await whatsappService.sendDailyReport(stats, hotLeads);
      }
  },
  dashboard: {
    getStats: async (): Promise<DashboardStats> => {
      if (useSheets()) return await sheetsService.calculateStats();
      return storage.calculateStats();
    },
    getLogs: async (): Promise<ActionLog[]> => {
      if (useSheets()) return await sheetsService.getLogs();
      return storage.getLogs();
    },
    logAction: async (action: string, detail: string, type: 'success' | 'info' | 'error' | 'warning') => {
        const log: ActionLog = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            action, detail, type
        };
        if (useSheets()) { await sheetsService.logAction(log); } else { storage.addLog(log); }
    }
  },
  tasks: {
    getAll: async (): Promise<Task[]> => {
      if (useSheets()) return await sheetsService.getTasks();
      return storage.getTasks();
    },
    create: async (task: Task): Promise<void> => {
        if (useSheets()) { await sheetsService.addTask(task); } else { storage.saveTask(task); }
    },
    update: async (task: Task): Promise<void> => {
        if (useSheets()) { await sheetsService.updateTask(task); } else { storage.updateTask(task); }
    }
  },
  calendar: {
      getAll: async () => {
          if (useSheets()) return await sheetsService.getCalendarEvents();
          return storage.getCalendarEvents();
      },
      create: async (event: any) => {
          if (useSheets()) return await sheetsService.createCalendarEvent(event);
          storage.saveCalendarEvent({...event, id: Math.random().toString(36).substr(2, 9)});
          return "https://meet.google.com/mock-link";
      }
  },
  templates: {
      getAll: async (): Promise<EmailTemplate[]> => { return storage.getTemplates(); },
      save: async (template: EmailTemplate) => { storage.saveTemplate(template); },
      update: async (template: EmailTemplate) => { storage.updateTemplate(template); },
      delete: async (id: string) => { storage.deleteTemplate(id); },
      
      generateColdEmail: async (lead: Lead) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          
          let personaContext = "";
          if (lead.personaAnalysis) {
              personaContext = `
                ALICI PROFİLİ: ${lead.personaAnalysis.type}
                İLETİŞİM TARZI: ${lead.personaAnalysis.communicationStyle}
                DİKKAT EDİLECEKLER: ${lead.personaAnalysis.traits.join(', ')}.
              `;
          } else {
              personaContext = "Profil bilinmiyor, genel ve profesyonel bir dil kullan.";
          }

          const prompt = `
            Lead: ${lead.firma_adi} (${lead.sektor})
            Durum: ${lead.lead_durumu}
            ${personaContext}
            GÖREV: Cold Email yaz. JSON döndür.
            { "subject": "...", "body": "...", "cta": "...", "tone": "..." }
          `;
          
          try {
            const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
            return parseGeminiJson(response.text || '{}');
          } catch (e) {
            console.error("Cold Email Generation Failed", e);
            return { subject: "Tanışma", body: "Merhaba, sizinle çalışmak isteriz.", cta: "Görüşelim", tone: "Neutral" };
          }
      }
  },
  reports: {
    getPerformanceData: async () => {
        const leads = useSheets() ? await sheetsService.getLeads() : storage.getLeads();
        const interactions = useSheets() ? await sheetsService.getInteractions() : storage.getInteractions();
        const funnel = [
            { name: 'Taranan', value: Math.floor(leads.length * 1.5) + 20, fill: '#94a3b8' },
            { name: 'Lead', value: leads.length, fill: '#6366f1' },
            { name: 'Temas', value: leads.filter(l => ['takipte', 'teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length, fill: '#8b5cf6' },
            { name: 'Yanıt', value: leads.filter(l => ['teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length, fill: '#ec4899' },
            { name: 'Teklif', value: leads.filter(l => l.lead_durumu === 'teklif_gonderildi').length, fill: '#f59e0b' },
            { name: 'Satış', value: leads.filter(l => l.lead_durumu === 'olumlu').length, fill: '#10b981' },
        ];
        const weeklyTrend = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });
            const sentCount = interactions.filter(int => int.date === dateStr && int.direction === 'outbound').length;
            const responseCount = interactions.filter(int => int.date === dateStr && int.direction === 'inbound').length;
            weeklyTrend.push({ name: dayName, sent: sentCount, response: responseCount });
        }
        const sectors: Record<string, { total: number, success: number }> = {};
        leads.forEach(l => {
            if (!sectors[l.sektor]) sectors[l.sektor] = { total: 0, success: 0 };
            sectors[l.sektor].total += 1;
            if (['teklif_gonderildi', 'olumlu'].includes(l.lead_durumu)) { sectors[l.sektor].success += 1; }
        });
        const sectorSuccessRate = Object.keys(sectors).map(key => ({
            subject: key, A: sectors[key].total * 10, B: sectors[key].success * 20, fullMark: 150
        })).slice(0, 5);
        return { funnel, weeklyTrend, sectorSuccessRate };
    }
  },
  briefing: {
      generateAndPlay: async () => {
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });
          const stats = await api.dashboard.getStats();
          const tasks = await api.tasks.getAll();
          const leads = await api.leads.getAll();
          const progress = gamificationService.getProgress();
          const insights = learningService.getInsights().slice(0, 2); 
          
          const urgentTasks = tasks.filter(t => t.durum === 'açık' && t.oncelik === 'Yüksek').length;
          const hotLeads = leads.filter(l => l.lead_skoru >= 4 && l.lead_durumu !== 'olumlu').length;
          
          let insightText = "";
          if (insights.length > 0) {
              insightText = `Önemli Gelişme: ${insights[0].message} (${insights[0].impact})`;
          }

          const scriptPrompt = `
            Rol: Satış Ajanı Brifingi.
            Veriler: Hedef %${stats.hedef_orani}, Sıcak Lead ${hotLeads}, Acil Görev ${urgentTasks}.
            AI Analizi: ${insightText}
            Ton: Enerjik, motive edici. Kısa tut.
          `;
          
          const scriptResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: scriptPrompt });
          const scriptText = scriptResponse.text || "Günaydın!";
          const ttsResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{ parts: [{ text: scriptText }] }],
              config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
          });
          const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
              const audioBuffer = await decodeAudioData(base64ToArrayBuffer(base64Audio), 24000);
              await playAudioBuffer(audioBuffer);
              return scriptText;
          }
          throw new Error("Audio generation failed");
      }
  },
  training: {
      evaluateSession: async (transcript: string, scenario: string) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Evaluate sales training. Scenario: ${scenario}. Transcript: ${transcript}. JSON: { score, feedback, tips }`;
          const response = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt, config: { responseMimeType: 'application/json' } });
          return parseGeminiJson(response.text || '{}');
      }
  },
  system: {
      testApiKey: async (apiKey: string) => {
          try {
              const ai = new GoogleGenAI({ apiKey });
              const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
              await model.generateContent("Test");
              return { success: true };
          } catch (e: any) { return { success: false, message: e.message }; }
      }
  },
  setup: {
      generatePackages: async (baseCost: number, margin: number, type: string): Promise<PricingPackage[]> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Generate 3 pricing packages for ${type}. Base Cost ${baseCost}, Margin ${margin}%. JSON format.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          return parseGeminiJson(response.text || '[]');
      },
      generateInitialTemplates: async (packages: PricingPackage[]): Promise<EmailTemplate[]> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Generate 3 cold emails for packages ${JSON.stringify(packages.map(p => p.name))}. JSON format.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          return parseGeminiJson(response.text || '[]');
      }
  },
  strategy: {
      getInsights: async () => { return []; },
      analyzeMarket: async (sector: string, district: string): Promise<MarketStrategyResult> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Analyze market for ${sector} in ${district}. JSON output required.`;
          try {
              const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
              return { ...parseGeminiJson(response.text || '{}'), lastUpdated: new Date().toISOString() };
          } catch (e) {
              return { marketAnalysis: { sectorDigitalMaturity: 5, regionEconomicActivity: 5, seasonalFactor: "Bilinmiyor", overallOpportunity: "Orta" }, idealLeadProfile: { companyAge: "-", employeeCount: "-", estimatedRevenue: "-", digitalMaturity: 3, hasWebsite: false, reasoning: "Error" }, strategyPriority: [], regionRotation: [], actionPlan: { nextCycle: "-", expectedLeadQuality: "-", estimatedConversion: "-" } };
          }
      },
      predictNextMove: async (lead: Lead): Promise<StrategyResult> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Lead: ${lead.firma_adi}. Predict next moves/questions. JSON format.`;
          try {
            const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
            return parseGeminiJson(response.text || '{}');
          } catch (e) {
            console.error("Prediction Failed", e);
            return { possibleQuestions: [], recommendedTone: 'neutral', reasoning: "Hata" };
          }
      },
      calculateLeadScore: async (lead: Lead): Promise<LeadScoreDetails> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Lead Score: ${lead.firma_adi}. JSON output.`;
          try {
            const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
            const data = parseGeminiJson(response.text || '{}');
            const rawScore = data.finalLeadScore || 1;
            const adjustedScore = learningService.applyWeights(rawScore, lead);
            data.finalLeadScore = adjustedScore;
            return { ...data, lastCalculated: new Date().toISOString() };
          } catch (e) {
              return { categoryScores: {}, totalScore: 0, finalLeadScore: 1, digitalWeaknesses: [], opportunityAreas: [], estimatedConversionProbability: "Bilinmiyor", reasoning: "Hata", lastCalculated: new Date().toISOString(), bonusFactors: {} } as any;
          }
      },
      analyzePersona: async (lead: Lead): Promise<PersonaAnalysis> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Persona: ${lead.firma_adi}. JSON.`;
          try {
            const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
            return parseGeminiJson(response.text || '{}');
          } catch (e) {
              return { type: 'Bilinmiyor', traits: [], communicationStyle: 'Profesyonel', reasoning: 'Hata' };
          }
      }
  },
  competitors: {
      analyze: async (lead: Lead): Promise<CompetitorAnalysis> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Analyze competitors for ${lead.firma_adi}. JSON output.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          return { ...parseGeminiJson(response.text || '{}'), lastUpdated: new Date().toISOString() };
      }
  },
  visuals: {
      generateHeroImage: async (lead: Lead): Promise<string> => { return "https://via.placeholder.com/800x600?text=Web+Design+Preview"; },
      generateSocialPostImage: async (prompt: string): Promise<string> => { return "https://via.placeholder.com/400x400?text=Social+Post"; }
  },
  social: {
      analyzeInstagram: async (lead: Lead): Promise<InstagramAnalysis> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Analyze Instagram for ${lead.firma_adi}. JSON output.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
          return { ...parseGeminiJson(response.text || '{}'), lastAnalyzed: new Date().toISOString() };
      }
  }
};
