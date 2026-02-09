
import { Lead, DashboardStats, Task, ActionLog, Interaction, EmailTemplate, InteractionAnalysis, InteractionType, CalendarEvent, UserProfile, PricingPackage } from '../types';
import { sheetsService } from './googleSheetsService';
import { gmailService } from './gmailService';
import { whatsappService } from './whatsappService';
import { storage } from './storage';
import { gamificationService } from './gamificationService';
import { GoogleGenAI, Modality } from "@google/genai";
import { decodeAudioData, playAudioBuffer, base64ToArrayBuffer } from '../utils/audioUtils';

// Helper to decide data source
const useSheets = () => {
    return sheetsService.isAuthenticated && localStorage.getItem('sheetId');
};

const getApiKey = () => {
    // 1. Env (Development)
    if (process.env.API_KEY) return process.env.API_KEY;
    // 2. Explicit Gemini Key (New)
    const geminiKey = localStorage.getItem('geminiApiKey');
    if (geminiKey) return geminiKey;
    // 3. Fallback to generic 'apiKey' (Legacy/Migration)
    return localStorage.getItem('apiKey') || '';
};

// --- ROBUST JSON PARSER ---
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
                throw new Error("No valid JSON found in response");
            }
        }
    }
};

export const api = {
  leads: {
    getAll: async (): Promise<Lead[]> => {
      if (useSheets()) {
          return await sheetsService.getLeads();
      }
      return storage.getLeads();
    },
    create: async (lead: Lead): Promise<Lead> => {
      // Gamification Hook
      gamificationService.recordAction('lead_add');
      
      if (useSheets()) {
          await sheetsService.addLead(lead);
          return lead;
      }
      storage.saveLead(lead);
      return lead;
    },
    update: async (lead: Lead): Promise<void> => {
        // Gamification Check: Won?
        if (lead.lead_durumu === 'olumlu') {
             // Only if it wasn't already won
             gamificationService.recordAction('deal_won');
        }

        if (useSheets()) {
            await sheetsService.updateLead(lead);
        } else {
            storage.updateLead(lead);
        }
    },
    logInteraction: async (leadId: string, type: InteractionType, summary?: string, analysis?: InteractionAnalysis): Promise<void> => {
        // Gamification Hook
        if (type === 'email') gamificationService.recordAction('email_sent');
        if (type === 'phone') gamificationService.recordAction('call_made');

        const interaction: Interaction = {
            id: Math.random().toString(36).substr(2, 9),
            leadId,
            type,
            direction: 'outbound', // Default, but can be implied 'inbound' if analysis exists.
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            summary: summary || 'Otomatik Etkileşim',
            status: analysis ? 'read' : 'sent', // If we have analysis, it's a read message
            analysis // Optional analysis data
        };

        // If analysis is present, it's inbound
        if (analysis) {
            interaction.direction = 'inbound';
        }

        if (useSheets()) {
            await sheetsService.addInteraction(interaction);
        } else {
            storage.addInteraction(interaction);
        }
    }
  },
  
  gmail: {
      send: async (to: string, subject: string, body: string, attachments?: { filename: string, content: string, mimeType: string }[]) => {
          gamificationService.recordAction('email_sent');
          
          if (useSheets()) {
              return await gmailService.sendEmail(to, subject, body, attachments);
          }
          // Simulate email sending delay
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log("Local Simulation: Email Sent:", { to, subject });
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
      if (useSheets()) {
          return await sheetsService.calculateStats();
      }
      return storage.calculateStats();
    },
    getLogs: async (): Promise<ActionLog[]> => {
      if (useSheets()) {
          return await sheetsService.getLogs();
      }
      return storage.getLogs();
    },
    logAction: async (action: string, detail: string, type: 'success' | 'info' | 'error' | 'warning') => {
        const log: ActionLog = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            action,
            detail,
            type
        };

        if (useSheets()) {
            await sheetsService.logAction(log);
        } else {
            storage.addLog(log);
        }
    }
  },

  tasks: {
    getAll: async (): Promise<Task[]> => {
      if (useSheets()) {
          return await sheetsService.getTasks();
      }
      return storage.getTasks();
    },
    create: async (task: Task): Promise<void> => {
        if (useSheets()) {
            await sheetsService.addTask(task);
        } else {
            storage.saveTask(task);
        }
    },
    update: async (task: Task): Promise<void> => {
        if (useSheets()) {
            await sheetsService.updateTask(task);
        } else {
            storage.updateTask(task);
        }
    }
  },

  templates: {
      getAll: async (): Promise<EmailTemplate[]> => {
          return storage.getTemplates();
      },
      save: async (template: EmailTemplate) => {
          storage.saveTemplate(template);
      },
      update: async (template: EmailTemplate) => {
          storage.updateTemplate(template);
      },
      delete: async (id: string) => {
          storage.deleteTemplate(id);
      },
      generateABVariants: async (template: EmailTemplate) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `
            GÖREV: E-posta A/B testi için varyasyonlar üret.
            MEVCUT ŞABLON:
            Konu: ${template.subject}
            Gövde: ${template.body}
            
            ÇIKTI (JSON Array): 2 adet farklı varyasyon. 
            [{ "subject": "...", "body": "...", "predictedOpenRate": 0-100, "reasoning": "..." }]
          `;
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          return parseGeminiJson(response.text || '[]');
      }
  },

  reports: {
    getPerformanceData: async () => {
        const leads = useSheets() ? await sheetsService.getLeads() : storage.getLeads();
        const interactions = useSheets() ? await sheetsService.getInteractions() : storage.getInteractions();

        // 1. Funnel Calculation
        const funnel = [
            { name: 'Taranan', value: Math.floor(leads.length * 1.5) + 20, fill: '#94a3b8' },
            { name: 'Lead', value: leads.length, fill: '#6366f1' },
            { name: 'Temas', value: leads.filter(l => ['takipte', 'teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length, fill: '#8b5cf6' },
            { name: 'Yanıt', value: leads.filter(l => ['teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length, fill: '#ec4899' },
            { name: 'Teklif', value: leads.filter(l => l.lead_durumu === 'teklif_gonderildi').length, fill: '#f59e0b' },
            { name: 'Satış', value: leads.filter(l => l.lead_durumu === 'olumlu').length, fill: '#10b981' },
        ];

        // 2. Weekly Trend
        const weeklyTrend = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });

            const sentCount = interactions.filter(int => int.date === dateStr && int.direction === 'outbound').length;
            const responseCount = interactions.filter(int => int.date === dateStr && int.direction === 'inbound').length;

            weeklyTrend.push({
                name: dayName,
                sent: sentCount,
                response: responseCount
            });
        }

        // 3. Sector Success
        const sectors: Record<string, { total: number, success: number }> = {};
        leads.forEach(l => {
            if (!sectors[l.sektor]) sectors[l.sektor] = { total: 0, success: 0 };
            sectors[l.sektor].total += 1;
            if (['teklif_gonderildi', 'olumlu'].includes(l.lead_durumu)) {
                sectors[l.sektor].success += 1;
            }
        });

        const sectorSuccessRate = Object.keys(sectors).map(key => ({
            subject: key,
            A: sectors[key].total * 10,
            B: sectors[key].success * 20,
            fullMark: 150
        })).slice(0, 5);

        return { funnel, weeklyTrend, sectorSuccessRate };
    }
  },

  briefing: {
      generateAndPlay: async () => {
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });

          // 1. Gather Data
          const stats = await api.dashboard.getStats();
          const tasks = await api.tasks.getAll();
          const leads = await api.leads.getAll();
          const progress = gamificationService.getProgress();
          
          const urgentTasks = tasks.filter(t => t.durum === 'açık' && t.oncelik === 'Yüksek').length;
          const hotLeads = leads.filter(l => l.lead_skoru >= 4 && l.lead_durumu !== 'olumlu').length;
          const streak = progress.streakDays;

          // 2. Generate Script (Text)
          const scriptPrompt = `
            Aşağıdaki verilere dayanarak bir satış ajanı için 40-50 kelimelik, enerjik, motive edici ve Türkçe bir sabah brifingi metni yaz.
            Veriler: %${stats.hedef_orani} hedef, ${hotLeads} sıcak lead, ${urgentTasks} acil görev, ${streak} gün seri.
          `;

          const scriptResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview', 
              contents: scriptPrompt,
          });
          const scriptText = scriptResponse.text || "Günaydın! Verileri alamadım ama harika bir gün olacak.";

          // 3. Generate Audio (TTS)
          const ttsResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{ parts: [{ text: scriptText }] }],
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' }
                      }
                  }
              }
          });

          // 4. Play Audio
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
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });

          const prompt = `
            GÖREV: Bir satış eğitim simülasyonunu değerlendir.
            SENARYO: ${scenario}
            DİYALOG: ${transcript}
            ÇIKTI (JSON): { "score": 0-100, "feedback": "...", "tips": ["..."] }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp', // Using 2.0 exp for better reasoning fallback
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const data = parseGeminiJson(response.text || '{}');
          
          if (data.score && data.score >= 70) {
              gamificationService.recordAction('deal_won');
          }

          return data;
      }
  },

  strategy: {
      getInsights: async () => {
          // Placeholder
          return [];
      }
  },

  competitors: {
      analyze: async (lead: Lead) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `
            "${lead.firma_adi}" (${lead.sektor}, ${lead.ilce}) için rakipleri analiz et.
            ÇIKTI (JSON): { "competitors": [{"name": "...", "website": "...", "strengths": ["..."], "weaknesses": ["..."]}], "summary": "..." }
          `;
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { 
                  tools: [{ googleSearch: {} }],
                  responseMimeType: 'application/json'
              }
          });
          
          return parseGeminiJson(response.text || '{}');
      }
  },

  visuals: {
      generateHeroImage: async (lead: Lead): Promise<string> => {
          // Using a placeholder service since image generation models need strict handling
          // In a real scenario with Imagen access, you'd use that here.
          return `https://via.placeholder.com/800x400?text=${encodeURIComponent(lead.firma_adi)}+Web+Design`;
      },
      generateSocialPostImage: async (prompt: string): Promise<string> => {
          return `https://via.placeholder.com/400?text=Social+Post`;
      }
  },

  social: {
      analyzeInstagram: async (lead: Lead) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `"${lead.firma_adi}" Instagram profilini analiz et (simülasyon). JSON: { "username": "...", "bio": "...", "recentPostTheme": "...", "suggestedDmOpener": "..." }`;
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          return parseGeminiJson(response.text || '{}');
      }
  },

  setup: {
      generatePackages: async (baseCost: number, margin: number, serviceType: string): Promise<PricingPackage[]> => {
          const apiKey = getApiKey();
          if (!apiKey) throw new Error("API Key eksik!");
          
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `
            Bir dijital ajans için 3 adet fiyatlandırma paketi oluştur.
            Hizmet: ${serviceType}
            Taban Maliyet: ${baseCost} TL
            Hedef Kar Marjı: %${margin}
            
            Paketler: Başlangıç, Profesyonel, Kurumsal.
            Fiyatları mantıklı şekilde artır.
            
            ÇIKTI FORMATI (JSON Array):
            [
              {
                "id": "p1",
                "name": "Başlangıç Paketi",
                "price": 5000,
                "cost": 3000,
                "profit": 2000,
                "features": ["Özellik 1", "Özellik 2"],
                "description": "Kısa açıklama"
              }
            ]
          `;

          try {
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: prompt,
                  config: { responseMimeType: 'application/json' }
              });
              
              return parseGeminiJson(response.text || '[]');
          } catch (error) {
              console.warn("Gemini 3 failed, trying fallback model...");
              // Fallback to 2.0 Flash Exp if 3 fails (often more stable for JSON)
              const fallbackAi = new GoogleGenAI({ apiKey });
              const fallbackResponse = await fallbackAi.models.generateContent({
                  model: 'gemini-2.0-flash-exp',
                  contents: prompt,
                  config: { responseMimeType: 'application/json' }
              });
              return parseGeminiJson(fallbackResponse.text || '[]');
          }
      },
      
      generateInitialTemplates: async (packages: PricingPackage[]): Promise<EmailTemplate[]> => {
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `
            Bu paketleri satmak için 3 farklı soğuk e-posta şablonu (Intro, Follow-up 1, Follow-up 2) yaz.
            Paketler: ${JSON.stringify(packages.map(p => p.name + ": " + p.price + "TL"))}
            
            JSON Array olarak döndür:
            [{ "id": "t1", "name": "...", "type": "intro", "subject": "...", "body": "...", "isActive": true, "useCount": 0, "successCount": 0 }]
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp', // Using 2.0 for stability
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          return parseGeminiJson(response.text || '[]');
      }
  },

  calendar: {
      getAll: async (): Promise<CalendarEvent[]> => {
          if (useSheets()) {
              return await sheetsService.getCalendarEvents();
          }
          return storage.getCalendarEvents();
      },
      create: async (event: Partial<CalendarEvent>): Promise<string> => {
          const newEvent: CalendarEvent = {
              id: Math.random().toString(36).substr(2, 9),
              title: event.title || 'Yeni Etkinlik',
              start: event.start || new Date().toISOString(),
              end: event.end || new Date().toISOString(),
              description: event.description || '',
              location: event.location || '',
              attendees: event.attendees || [],
              type: event.type || 'meeting'
          };
          
          if (useSheets()) {
              return await sheetsService.createCalendarEvent(newEvent);
          } else {
              storage.saveCalendarEvent(newEvent);
              return event.location === 'Google Meet' ? `https://meet.google.com/mock-${Math.random().toString(36).substr(2,5)}` : '';
          }
      }
  }
};
