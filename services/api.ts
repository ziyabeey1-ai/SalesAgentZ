
import { Lead, DashboardStats, Task, ActionLog, Interaction, EmailTemplate, InteractionAnalysis, InteractionType, StrategyResult, PersonaAnalysis, MarketStrategyResult, PricingPackage, CalendarEvent, LeadScoreDetails, InstagramAnalysis, CompetitorAnalysis } from '../types';
import { sheetsService } from './googleSheetsService';
import { gmailService } from './gmailService';
import { whatsappService } from './whatsappService';
import { storage } from './storage';
import { gamificationService } from './gamificationService';
import { GoogleGenAI, Modality } from "@google/genai";
import { decodeAudioData, playAudioBuffer, base64ToArrayBuffer } from '../utils/audioUtils';
import { SYSTEM_PROMPT } from '../constants';

const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

// Helper to decide data source
const useSheets = () => {
    return sheetsService.isAuthenticated && localStorage.getItem('sheetId');
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
      gamificationService.recordAction('lead_add');
      if (useSheets()) {
          await sheetsService.addLead(lead);
          return lead;
      }
      storage.saveLead(lead);
      return lead;
    },
    update: async (lead: Lead): Promise<void> => {
        if (lead.lead_durumu === 'olumlu') {
             gamificationService.recordAction('deal_won');
        }
        if (useSheets()) {
            await sheetsService.updateLead(lead);
        } else {
            storage.updateLead(lead);
        }
    },
    logInteraction: async (leadId: string, type: InteractionType, summary?: string, analysis?: InteractionAnalysis): Promise<void> => {
        if (type === 'email') gamificationService.recordAction('email_sent');
        if (type === 'phone') gamificationService.recordAction('call_made');

        const interaction: Interaction = {
            id: Math.random().toString(36).substr(2, 9),
            leadId,
            type,
            direction: 'outbound',
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            summary: summary || 'Otomatik Etkileşim',
            status: analysis ? 'read' : 'sent',
            analysis
        };

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
  
  interactions: {
      getRecent: async (limit: number = 10): Promise<Interaction[]> => {
          const all = useSheets() ? await sheetsService.getInteractions() : storage.getInteractions();
          return all.sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()).slice(0, limit);
      }
  },

  gmail: {
      send: async (to: string, subject: string, body: string, attachments?: any[]) => {
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
      recordUsage: async (id: string, sector: string) => {
          storage.incrementTemplateUsage(id, sector);
      },
      generateColdEmail: async (lead: Lead) => {
          try {
            const ai = new GoogleGenAI({ apiKey: getApiKey() });
            const prompt = `Write a cold email for ${lead.firma_adi} in ${lead.sektor} sector. Target persona: ${lead.personaAnalysis?.type || 'General'}. JSON format: {subject, body, cta, tone}`;
            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(result.text || '{}');
          } catch (e) {
              console.error("Generate cold email failed", e);
              return { subject: "Merhaba", body: "İçerik üretilemedi.", cta: "", tone: "Neutral" };
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
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const stats = await api.dashboard.getStats();
          const scriptPrompt = `Generate a short motivational briefing text in Turkish based on these stats: ${JSON.stringify(stats)}.`;
          
          const scriptResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: scriptPrompt,
          });
          const scriptText = scriptResponse.text || "Günaydın!";

          const ttsResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{ parts: [{ text: scriptText }] }],
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
              }
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
          const prompt = `Evaluate this sales call transcript based on scenario "${scenario}". Output JSON with score (0-100), feedback, and tips. Transcript: ${transcript}`;
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          const data = JSON.parse(response.text || '{}');
          if (data.score && data.score >= 70) gamificationService.recordAction('deal_won');
          return data;
      }
  },

  strategy: {
      analyzeMarket: async (sector: string, district: string): Promise<MarketStrategyResult> => {
          return {
              marketAnalysis: { sectorDigitalMaturity: 6, regionEconomicActivity: 8, seasonalFactor: 'High', overallOpportunity: 'Yüksek' },
              idealLeadProfile: { companyAge: '2-5 Yıl', employeeCount: '10-50', estimatedRevenue: '5M+', digitalMaturity: 4, hasWebsite: false, reasoning: 'Growth potential' },
              strategyPriority: [{ name: 'SEO Odaklı', priority: 1, score: 90, reasoning: 'High search volume', searchTerms: ['web tasarım'] }],
              regionRotation: [],
              actionPlan: { nextCycle: 'Next Week', expectedLeadQuality: 'High', estimatedConversion: '5%' }
          };
      },
      analyzePersona: async (lead: Lead): Promise<PersonaAnalysis> => {
          return { type: 'Analitik', traits: ['Data-driven'], communicationStyle: 'Formal', reasoning: 'Sector based' };
      },
      predictNextMove: async (lead: Lead): Promise<StrategyResult> => {
          return { 
              possibleQuestions: [
                  { question: "Fiyat nedir?", category: "pricing", responses: { aggressive: "Pahalı değil, değerli.", neutral: "Bütçenize göre planlarız.", consultative: "Yatırım getirisi odaklı bakalım." } }
              ],
              recommendedTone: 'neutral', 
              reasoning: 'Standard approach' 
          };
      },
      calculateLeadScore: async (lead: Lead): Promise<LeadScoreDetails> => {
          return { 
              categoryScores: { website: 5, seo: 3, socialMedia: 4, onlineSystem: 2, contentQuality: 3, competitorGap: 4, sectorUrgency: 5 },
              bonusFactors: {}, totalScore: 50, finalLeadScore: 3, digitalWeaknesses: ['SEO Zayıf'], opportunityAreas: ['Sosyal Medya'], estimatedConversionProbability: 'Orta', reasoning: 'Basic score', lastCalculated: new Date().toISOString()
          };
      }
  },

  competitors: {
      analyze: async (lead: Lead): Promise<CompetitorAnalysis> => {
          return { competitors: [], summary: 'Rakip analizi tamamlandı (Mock)', lastUpdated: new Date().toISOString() };
      }
  },

  visuals: {
      generateHeroImage: async (lead: Lead): Promise<string> => {
          return "https://via.placeholder.com/800x400.png?text=Website+Preview"; 
      },
      generateSocialPostImage: async (prompt: string): Promise<string> => {
          return "https://via.placeholder.com/400x400.png?text=Social+Post"; 
      }
  },

  social: {
      analyzeInstagram: async (lead: Lead): Promise<InstagramAnalysis> => {
          return { username: 'mock_user', bio: 'Mock Bio', recentPostTheme: 'Lifestyle', suggestedDmOpener: 'Hello', lastAnalyzed: new Date().toISOString() };
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
          if (useSheets()) {
              return await sheetsService.createCalendarEvent(event);
          }
          const newEvent = { ...event, id: Math.random().toString(36).substr(2, 9) } as CalendarEvent;
          storage.saveCalendarEvent(newEvent);
          return "";
      }
  },

  system: {
      testApiKey: async (key: string) => {
          try {
              const ai = new GoogleGenAI({ apiKey: key });
              await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'Test' });
              return { success: true };
          } catch (e: any) {
              return { success: false, message: e.message };
          }
      }
  },

  setup: {
      generatePackages: async (cost: number, margin: number, type: string): Promise<PricingPackage[]> => {
          return [
              { id: '1', name: 'Başlangıç', price: Math.round(cost * (1 + margin/100)), cost: cost, profit: Math.round(cost * margin/100), features: ['Temel Özellik'], description: 'Giriş seviyesi' }
          ];
      },
      generateInitialTemplates: async (packages: PricingPackage[]): Promise<EmailTemplate[]> => {
          return [
              { id: 't1', name: 'Tanışma', type: 'intro', subject: 'Merhaba', body: 'Tanışalım', isActive: true, useCount: 0, successCount: 0 }
          ];
      }
  }
};
