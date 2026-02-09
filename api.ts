
import { Lead, DashboardStats, Task, ActionLog, Interaction, EmailTemplate, InteractionAnalysis, InteractionType } from '../types';
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
             // Only if it wasn't already won (simple check logic would be needed in real app to avoid dupes)
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
      send: async (to: string, subject: string, body: string) => {
          gamificationService.recordAction('email_sent');
          
          if (useSheets()) {
              return await gmailService.sendEmail(to, subject, body);
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
          // Templates are currently local-only to keep it simple and fast
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
      }
  },

  reports: {
    getPerformanceData: async () => {
        // Use local storage data to generate reports if offline
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

        // 2. Weekly Trend (Calculated from interactions)
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
          const apiKey = process.env.API_KEY || '';
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
            
            Veriler:
            - Günlük Hedef: %${stats.hedef_orani} tamamlandı.
            - Sıcak Lead: ${hotLeads} adet.
            - Acil Görev: ${urgentTasks} adet.
            - Seri (Streak): ${streak} gün.
            
            Format:
            Bir radyo sunucusu veya kişisel koç gibi konuş. İsmini kullanma, direkt konuya gir.
            Örn: "Günaydın! Bugün harika gidiyorsun, hedefin %80'i cepte..."
          `;

          const scriptResponse = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp',
              contents: scriptPrompt,
          });
          const scriptText = scriptResponse.text || "Günaydın, verilere ulaşamadım ama bugün harika bir gün olacak!";

          // 3. Generate Audio (TTS)
          const ttsResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{ parts: [{ text: scriptText }] }],
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' } // Kore, Fenrir, Puck, Charon
                      }
                  }
              }
          });

          // 4. Play Audio
          const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
              const audioBuffer = await decodeAudioData(base64ToArrayBuffer(base64Audio), 24000); // 24k is standard for Gemini TTS
              await playAudioBuffer(audioBuffer);
              return scriptText;
          }
          throw new Error("Audio generation failed");
      }
  },

  training: {
      evaluateSession: async (transcript: string, scenario: string) => {
          const apiKey = process.env.API_KEY || '';
          const ai = new GoogleGenAI({ apiKey });

          const prompt = `
            GÖREV: Bir satış eğitim simülasyonunu değerlendir.
            
            SENARYO: ${scenario}
            
            DİYALOG GEÇMİŞİ:
            ${transcript}
            
            DEĞERLENDİRME KRİTERLERİ:
            1. Empati: Müşteriyi anladı mı?
            2. İkna: İtirazları mantıklı karşıladı mı?
            3. Profesyonellik: Tonu ve dili uygun muydu?
            
            ÇIKTI FORMATI (JSON):
            {
                "score": 0-100 arası bir puan,
                "feedback": "Kısa, yapıcı bir geri bildirim paragrafı (Türkçe).",
                "tips": ["Gelişim önerisi 1", "Gelişim önerisi 2"]
            }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const data = JSON.parse(response.text || '{}');
          
          // Gamification Reward
          if (data.score && data.score >= 70) {
              // Award heavy XP for passing training
              gamificationService.recordAction('deal_won'); // Re-using deal_won trigger for 500xp simulation
          }

          return data;
      }
  }
};
