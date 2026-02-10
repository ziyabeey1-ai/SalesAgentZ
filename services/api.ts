
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

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const BLOCKED_EMAIL_FRAGMENTS = ['example.com', 'email.com', 'test@', 'noreply@', 'no-reply@'];
const FREE_EMAIL_DOMAINS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yandex.com']);

// NEW: Public domains to skip advanced validation
const COMMON_PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
    'yahoo.com', 'yandex.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com'
]);

const KNOWN_INVALID_DOMAINS = new Set([
    'example.com', 'email.com', 'test.com', 'localhost', 'localdomain'
]);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isValidLeadEmail = (email: string): boolean => {
    const normalized = normalizeEmail(email);
    return EMAIL_REGEX.test(normalized) && !BLOCKED_EMAIL_FRAGMENTS.some(fragment => normalized.includes(fragment));
};

const isHighConfidenceFreeEmail = (email: string, confidenceScore?: number, source?: string): boolean => {
    const domain = normalizeEmail(email).split('@')[1] || '';
    if (!FREE_EMAIL_DOMAINS.has(domain)) return true;
    return (confidenceScore || 0) >= 90 && Boolean(source);
};

type DomainCheckResult = 'valid' | 'invalid' | 'unknown';

const extractEmailDomain = (email: string): string | null => {
    const normalized = (email || '').trim().toLowerCase();
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex === -1 || atIndex === normalized.length - 1) return null;
    const domain = normalized.slice(atIndex + 1).trim();
    return domain || null;
};

const hasValidDomainFormat = (domain: string): boolean => {
    if (!domain || domain.includes(' ') || !domain.includes('.')) return false;
    if (KNOWN_INVALID_DOMAINS.has(domain)) return false;
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
};

const fetchWithTimeout = async (url: string, timeoutMs: number, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const hasResolvableDns = async (domain: string): Promise<DomainCheckResult> => {
    try {
        const dnsUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`;
        const res = await fetchWithTimeout(dnsUrl, 4000, { headers: { Accept: 'application/json' } });
        if (!res.ok) return 'unknown';
        const data = await res.json();

        if (data?.Status === 3) return 'invalid'; // NXDOMAIN
        if (Array.isArray(data?.Answer) && data.Answer.length > 0) return 'valid';
        return 'unknown';
    } catch {
        // CORS/Network hatalarında gönderimi kilitleme (fail-open)
        return 'unknown';
    }
};

const isWebsiteReachable = async (domain: string): Promise<DomainCheckResult> => {
    const candidates = [`https://${domain}`, `https://www.${domain}`];

    for (const url of candidates) {
        try {
            await fetchWithTimeout(url, 5000, { method: 'GET', mode: 'no-cors', redirect: 'follow' });
            return 'valid';
        } catch {
            // sıradaki URL'e geç
        }
    }

    // Tarayıcı CORS veya kısa süreli ağ probleminde gönderimi bloklamayalım
    return 'unknown';
};

const validateRecipientDomainBeforeSend = async (recipientEmail: string) => {
    const domain = extractEmailDomain(recipientEmail);
    if (!domain) throw new Error(`ALICI_EMAIL_GECERSIZ:${recipientEmail}`);

    if (!hasValidDomainFormat(domain)) {
        throw new Error(`ALICI_DOMAIN_FORMAT_GECERSIZ:${domain}`);
    }

    if (COMMON_PUBLIC_EMAIL_DOMAINS.has(domain)) return;

    const dnsResult = await hasResolvableDns(domain);
    if (dnsResult === 'invalid') {
        throw new Error(`ALICI_DOMAIN_DNS_HATASI:${domain}`);
    }

    const websiteResult = await isWebsiteReachable(domain);
    if (websiteResult === 'invalid') {
        throw new Error(`ALICI_WEBSITE_ERISILEMIYOR:${domain}`);
    }

    if (dnsResult === 'unknown' || websiteResult === 'unknown') {
        console.warn(`[DOMAIN CHECK] Ağ/CORS nedeniyle kesin doğrulama yapılamadı, gönderime izin verildi: ${domain}`);
    }
};

const parseGeminiJson = (text: string) => {
    try {
        if (!text) return {};
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
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

const cleanAIResponse = (text: string, lead: Lead, profile: UserProfile): string => {
    if (!text) return "";
    let clean = text;

    const myName = profile.fullName || 'Satış Temsilcisi';
    const myCompany = profile.companyName || 'Ajansımız';
    
    clean = clean.replace(/\[Senin Adın\]/gi, myName);
    clean = clean.replace(/\[Adınız\]/gi, myName);
    clean = clean.replace(/\[İsminiz\]/gi, myName);
    clean = clean.replace(/\[Kendi Şirket Adınız\]/gi, myCompany);
    clean = clean.replace(/\[Şirket Adınız\]/gi, myCompany);
    clean = clean.replace(/\[Ajans Adı\]/gi, myCompany);
    clean = clean.replace(/\[Şirketiniz\]/gi, myCompany);

    const leadName = lead.firma_adi || 'Firma';
    const contactName = lead.yetkili_adi || 'Sayın Yetkili';
    
    clean = clean.replace(/\[Şirket Adı\]/gi, leadName); 
    clean = clean.replace(/\[Firma Adı\]/gi, leadName);
    clean = clean.replace(/\[Müşteri Şirket Adı\]/gi, leadName);
    clean = clean.replace(/\[İsim\]/gi, contactName);
    clean = clean.replace(/\[Yetkili\]/gi, contactName);
    clean = clean.replace(/\[Yetkili Adı\]/gi, contactName);
    clean = clean.replace(/\[Müşteri Adı\]/gi, contactName);

    return clean;
};

const useSheets = () => {
    return sheetsService.isAuthenticated && localStorage.getItem('sheetId');
};

const canUseGoogleWorkspaceApis = () => {
    return sheetsService.isAuthenticated;
};

export const api = {
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
            SİSTEM ROLÜ: Titiz Lead Araştırmacısı.
            GÖREV: İstanbul, ${district} bölgesindeki "${sector}" sektöründe hizmet veren aktif işletmeleri bul.
            
            ⚠️ KESİN KURALLAR (Email Doğrulama):
            1. Sadece GERÇEK ve DOĞRULANMIŞ e-posta adresi olanları getir.
            2. ASLA tahmin yürütme (Örn: 'info@firmaadi.com' gibi uydurma mailler YAZMA).
            3. Firmanın "İletişim", "Instagram Bio" veya "Facebook About" kısımlarını sanal olarak tara.
            4. Web sitesi "Yok" veya "Eski" olanlara öncelik ver.
            5. En az 2, en fazla 4 adet NİTELİKLİ firma bul. Nicelik değil nitelik önemli.

            İPUCU: Özellikle Bahçeşehir, Esenyurt, Beylikdüzü bölgelerine odaklan (Eğer talep bu bölgelerdense).

            JSON ÇIKTI FORMATI:
            {
              "leads": [
                {
                  "firma_adi": "...",
                  "adres": "...",
                  "telefon": "...",
                  "email": "...", 
                  "email_kaynagi": "Web Sitesi / Facebook / Instagram / Rehber",
                  "email_dogrulama_skoru": 0,
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
                    systemInstruction: SYSTEM_PROMPT + " Sadece JSON döndür. Asla sahte veri üretme. E-mail bulamazsan o firmayı listeye alma.",
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json'
                }
            });
            
            const data = parseGeminiJson(result.text || '{}');
            const foundLeads: Lead[] = [];

            if (data.leads && Array.isArray(data.leads)) {
                for (const item of data.leads) {
                    const email = item.email ? normalizeEmail(item.email) : '';
                    const confidenceScore = Number(item.email_dogrulama_skoru || 0);
                    const source = item.email_kaynagi || '';

                    if (
                        email &&
                        isValidLeadEmail(email) &&
                        confidenceScore >= 75 &&
                        isHighConfidenceFreeEmail(email, confidenceScore, source)
                    ) {
                        foundLeads.push({
                            id: Math.random().toString(36).substr(2, 9),
                            firma_adi: item.firma_adi || 'Bilinmiyor',
                            sektor: sector,
                            ilce: district,
                            adres: item.adres || district,
                            telefon: item.telefon || '',
                            email,
                            kaynak: 'AI Asistan',
                            websitesi_var_mi: item.web_sitesi_durumu === 'Yok' ? 'Hayır' : 'Evet',
                            lead_durumu: 'aktif',
                            lead_skoru: item.web_sitesi_durumu === 'Kötü' ? 4 : 3,
                            eksik_alanlar: [],
                            notlar: `[Otonom Keşif]: ${item.firsat_nedeni || 'Otomatik eklendi'} (Email Kaynağı: ${item.email_kaynagi || 'Google Search'})`
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
  interactions: {
      getRecent: async (limit: number = 10): Promise<Interaction[]> => {
          const all = useSheets() ? await sheetsService.getInteractions() : storage.getInteractions();
          // Sort by date and time desc
          return all
            .sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                return dateB.getTime() - dateA.getTime();
            })
            .slice(0, limit);
      }
  },
  gmail: {
      send: async (to: string, subject: string, body: string, attachments?: any[]) => {
          await validateRecipientDomainBeforeSend(to);
          gamificationService.recordAction('email_sent');
          if (canUseGoogleWorkspaceApis()) {
              const res = await gmailService.sendEmail(to, subject, body, attachments);
              return { ...res, _status: 'real' };
          }
          // Fallback to mock
          await new Promise(resolve => setTimeout(resolve, 800));
          console.warn(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
          return { id: 'local-mock-id', _status: 'mock' };
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
          const userProfile = storage.getUserProfile();
          
          let personaContext = "";
          if (lead.personaAnalysis) {
              personaContext = `
                ALICI PROFİLİ (NÖRO-PAZARLAMA): 
                - Kişilik Tipi: ${lead.personaAnalysis.type}
                - İletişim Tarzı: ${lead.personaAnalysis.communicationStyle} (Buna kesinlikle uy)
                - Dikkat Edilecekler: ${lead.personaAnalysis.traits.join(', ')}.
              `;
          } else {
              personaContext = "Alıcı profili net değil, ancak sektör dinamiklerine uygun, profesyonel ama samimi bir dil kullan.";
          }

          const senderContext = `
            GÖNDEREN KİMLİĞİ (SEN):
            Ad: ${userProfile.fullName || 'Satış Uzmanı'}
            Şirket: ${userProfile.companyName || 'Ajansımız'}
            Rol: ${userProfile.role || 'Danışman'}
            İletişim Tonu: ${userProfile.tone || 'Profesyonel'}
          `;

          // --- DEEP CONTEXT INJECTION ---
          const weakness = lead.scoreDetails?.digitalWeaknesses?.[0] || lead.digitalWeakness || "dijital görünürlük eksikliği";
          const leadScore = lead.scoreDetails?.finalLeadScore || lead.lead_skoru || 3;
          const competitorInsight = lead.competitorAnalysis?.summary 
              ? `Rakip Durumu: ${lead.competitorAnalysis.summary}` 
              : `Rakip Durumu: ${lead.ilce} bölgesindeki rakipleri dijitalde aktif.`;

          const prompt = `
            HEDEF FİRMA: "${lead.firma_adi}"
            SEKTÖR: ${lead.sektor} | BÖLGE: ${lead.ilce}
            YETKİLİ: ${lead.yetkili_adi || 'Sayın Yetkili'}
            DİJİTAL DURUMU: ${lead.websitesi_var_mi === 'Hayır' ? 'Web Sitesi Yok' : 'Web Sitesi Var ama Yetersiz'}
            TESPİT EDİLEN ZAYIFLIK: "${weakness}"
            ${competitorInsight}
            
            ${senderContext}
            ${personaContext}
            
            GÖREV: ${lead.firma_adi} için %100 ÖZELLEŞTİRİLMİŞ, robotik olmayan, samimi ve zekice kurgulanmış bir "Cold Email" yaz.
            
            STRATEJİ (PAS Modeli Uygula):
            1. PROBLEM (Kanca): Direkt konuya gir. ${lead.ilce} bölgesinde ${lead.sektor} arayanların onları bulamadığını veya "${weakness}" sorununu nazikçe yüzlerine vur.
            2. AGİTASYON (Derinleştirme): Rakiplerinin (${lead.competitorAnalysis?.competitors?.[0]?.name || 'rakipler'}) bu boşluğu doldurduğunu ve potansiyel ciro kaybettiklerini hissettir.
            3. ÇÖZÜM (Değer): Bizim ${userProfile.companyName} olarak bunu nasıl hızlıca çözeceğimizi (teknik detaya boğmadan) anlat.
            
            ⚠️ KRİTİK KURALLAR:
            - ASLA "Umarım iyisinizdir", "Ben X firmasından Y" gibi sıkıcı girişler yapma.
            - Konu başlığı (Subject) merak uyandırıcı olmalı (Örn: "${lead.firma_adi} için ${lead.ilce} analizi", "Müşterileriniz sizi neden bulamıyor?").
            - Metnin sonuna "Saygılarımla" veya imza EKLEME. (Sistem otomatik ekleyecek).
            - Eğer alıcı "Analitik" biriyse verilerden bahset, "Sosyal" biriyse itibardan bahset.
            - Kopyala-yapıştır gibi durmasın. Sanki şu an elle yazıyormuşsun gibi olsun.

            JSON FORMATINDA DÖNDÜR:
            { "subject": "...", "body": "...", "cta": "Kısa ve net bir eylem çağrısı (Örn: Yarın 10dk konuşalım mı?)", "tone": "..." }
          `;
          
          try {
            const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
            const result = parseGeminiJson(response.text || '{}');
            
            result.subject = cleanAIResponse(result.subject, lead, userProfile);
            result.body = cleanAIResponse(result.body, lead, userProfile);
            
            // Append signature manually if not present (logic handled in MailAutomation but good to ensure clean body)
            const signature = `\n\nSaygılarımla,\n\n${userProfile.fullName}\n${userProfile.role}\n${userProfile.companyName}\n${userProfile.website || ''}`;
            
            // Only strictly append if using raw generation output directly, 
            // but MailAutomation usually handles signature composition. 
            // We return pure body here to let UI compose it.
            
            return result;

          } catch (e) {
            console.error("Cold Email Generation Failed", e);
            return { 
                subject: `Merhaba ${lead.firma_adi} - Dijital Fırsat`, 
                body: `Merhaba,\n\n${lead.ilce} bölgesindeki işletmeleri incelerken firmanızı fark ettim. ${lead.sektor} sektöründe rakiplerinizin önüne geçmeniz için bazı fırsatlar gördüm.\n\nÖzellikle ${weakness} konusunda size destek olabiliriz.`, 
                cta: "Görüşelim", 
                tone: "Neutral" 
            };
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
              // Use correct method generateContent instead of getGenerativeModel
              await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: "Test connection",
              });
              return { success: true };
          } catch (e: any) { 
              return { success: false, message: e.message }; 
          }
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
