
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

type SenderVoice = {
    description: string;
    solutionLine: string;
    ctaLine: string;
};

const getSenderVoice = (profile: UserProfile): SenderVoice => {
    const rawEmail = normalizeEmail(profile.email || '');
    const domain = rawEmail.includes('@') ? rawEmail.split('@')[1] : '';
    const hasPublicEmail = FREE_EMAIL_DOMAINS.has(domain);
    const companyName = (profile.companyName || '').trim();
    const isFreelancerRole = /freelance|serbest/i.test(profile.role || '');

    // Kişisel mail + freelancer rolü durumunda "ben" dili varsayılır.
    if (hasPublicEmail || !companyName || isFreelancerRole) {
        return {
            description: 'Bir ajans ekibi gibi değil, tek kişi olarak birinci tekil şahıs (ben) diliyle yaz.',
            solutionLine: 'Bu sorunu hızlıca çözüp görünürlüğünüzü artırabilirim.',
            ctaLine: 'Uygunsanız 10 dakikalık kısa bir görüşme planlayabiliriz.'
        };
    }

    return {
        description: 'Kurumsal ekip diliyle (biz) yaz.',
        solutionLine: `${companyName} olarak bu sorunu hızlıca çözüp görünürlüğünüzü artırabiliriz.`,
        ctaLine: 'Uygunsanız 10 dakikalık kısa bir görüşme planlayabiliriz.'
    };
};


const getOutreachAngle = (lead: Lead): { name: string; instruction: string } => {
    const weakness = (lead.scoreDetails?.digitalWeaknesses?.[0] || lead.digitalWeakness || '').toLowerCase();
    const base = [
        { name: 'Kayıp Talep', instruction: 'Bölgedeki arama trafiğinde kaçan talebi yakalama perspektifinden yaz.' },
        { name: 'Rakip Farkı', instruction: 'Rakiplerin dijitalde aldığı avantajı kısa bir karşılaştırma diliyle işle.' },
        { name: 'Hızlı Kazanç', instruction: 'Hızlı uygulanabilir 1-2 iyileştirme ile erken sonuç alma temasını kullan.' },
        { name: 'Güven ve İtibar', instruction: 'İlk izlenim, güven ve müşteri karar sürecindeki itibar etkisini vurgula.' }
    ];

    if (weakness.includes('site yok')) return { name: 'Dijital Vitrin Eksik', instruction: 'Web sitesi yokluğu nedeniyle kaçan ilk temasları nazikçe görünür kıl.' };
    if (weakness.includes('mobil')) return { name: 'Mobil Dönüşüm', instruction: 'Mobil kullanıcıların hızlı karar verdiğini ve dönüşüm kaybını vurgula.' };

    return base[Math.abs((lead.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % base.length];
};

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
        const firstBracket = clean.indexOf('[');
        const lastBracket = clean.lastIndexOf(']');
        
        // Determine if it is an object or array and slice accordingly
        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace) && lastBracket !== -1) {
             clean = clean.substring(firstBracket, lastBracket + 1);
        } else if (firstBrace !== -1 && lastBrace !== -1) {
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
      recordUsage: async (templateId: string, sector: string = 'Diğer') => {
          if (!templateId || templateId === 'ai-generated') return;
          storage.incrementTemplateUsage(templateId, sector);
      },
      
      generateColdEmail: async (lead: Lead) => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const userProfile = storage.getUserProfile();
          const senderVoice = getSenderVoice(userProfile);
          const outreachAngle = getOutreachAngle(lead);
          
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
          const urgencyHint = leadScore >= 4
              ? 'Bu lead sıcak, CTA daha net ve takvim odaklı olsun.'
              : 'CTA yumuşak ama yönlendirici olsun.';
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
            YAKLAŞIM AÇISI: ${outreachAngle.name} — ${outreachAngle.instruction}
            
            STRATEJİ (PAS Modeli Uygula):
            1. PROBLEM (Kanca): Direkt konuya gir. ${lead.ilce} bölgesinde ${lead.sektor} arayanların onları bulamadığını veya "${weakness}" sorununu nazikçe yüzlerine vur.
            2. AGİTASYON (Derinleştirme): Rakiplerinin (${lead.competitorAnalysis?.competitors?.[0]?.name || 'rakipler'}) bu boşluğu doldurduğunu ve potansiyel ciro kaybettiklerini hissettir.
            3. ÇÖZÜM (Değer): ${senderVoice.solutionLine}
            
            ⚠️ KRİTİK KURALLAR:
            - ASLA "Umarım iyisinizdir", "Ben X firmasından Y" gibi sıkıcı girişler yapma.
            - ${senderVoice.description}
            - İlk temasta paket/fiyat listesi dökme. Alıcı sormadan TL veya paket kademeleri verme.
            - E-postayı 90-140 kelime bandında, kısa paragraflı yaz.
            - Somut bir gözlem cümlesi ekle (bölge/sektör/weakness bağlamında).
            - ${urgencyHint}
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
            
            return result;

          } catch (e) {
            console.error("Cold Email Generation Failed", e);
            return { 
                subject: `Merhaba ${lead.firma_adi} - Dijital Fırsat`, 
                body: `Merhaba,\n\n${lead.ilce} bölgesindeki işletmeleri incelerken firmanızı fark ettim. ${lead.sektor} sektöründe rakiplerinizin önüne geçmeniz için bazı fırsatlar gördüm.\n\nÖzellikle ${weakness} konusunda size destek olabilirim.`, 
                cta: leadScore >= 4 ? "Uygunsanız yarın 10 dakikalık hızlı bir görüşme planlayalım mı?" : senderVoice.ctaLine,
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
        
        // Sector Success
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
              model: 'gemini-3-flash-preview',
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
          const apiKey = getApiKey();
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
              model: 'gemini-3-flash-preview',
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

  visuals: {
      generateHeroImage: async (lead: Lead) => {
          // Placeholder using unsplash source for demo
          return `https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80`; 
      },
      generateSocialPostImage: async (prompt: string) => {
          return `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80`;
      }
  },

  social: {
      analyzeInstagram: async (lead: Lead): Promise<InstagramAnalysis> => {
          // Mock/Simulation
          return {
              username: lead.firma_adi.toLowerCase().replace(/ /g, ''),
              bio: `${lead.sektor} sektöründe lider hizmet.`,
              recentPostTheme: "Müşteri memnuniyeti",
              suggestedDmOpener: "Harika paylaşımlarınız var!",
              lastAnalyzed: new Date().toISOString()
          };
      }
  },

  competitors: {
      analyze: async (lead: Lead): Promise<CompetitorAnalysis> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `Analyze competitors for ${lead.firma_adi} in ${lead.sektor}, ${lead.ilce}. Return JSON with competitors list and summary.`;
          try {
              const res = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: prompt,
                  config: { responseMimeType: 'application/json' }
              });
              const json = parseGeminiJson(res.text || '{}');
              return {
                  competitors: json.competitors || [],
                  summary: json.summary || 'Analiz tamamlandı.',
                  lastUpdated: new Date().toISOString()
              };
          } catch (e) {
              return { competitors: [], summary: 'Analiz hatası', lastUpdated: new Date().toISOString() };
          }
      }
  },

  strategy: {
      analyzeMarket: async (sector: string, district: string): Promise<MarketStrategyResult> => {
           // Mock return matching type
           return {
               marketAnalysis: {
                   sectorDigitalMaturity: 7,
                   regionEconomicActivity: 8,
                   seasonalFactor: 'Yüksek',
                   overallOpportunity: 'Yüksek'
               },
               idealLeadProfile: {
                   companyAge: '1-5 Yıl',
                   employeeCount: '5-20',
                   estimatedRevenue: '5M+',
                   digitalMaturity: 4,
                   hasWebsite: true,
                   reasoning: 'Bölge analizi sonucu.'
               },
               strategyPriority: [],
               regionRotation: [],
               actionPlan: {
                   nextCycle: 'Hemen',
                   expectedLeadQuality: 'Yüksek',
                   estimatedConversion: '20%'
               },
               lastUpdated: new Date().toISOString()
           };
      },
      predictNextMove: async (lead: Lead): Promise<StrategyResult> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          try {
              const res = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Predict strategy for lead ${lead.firma_adi}. JSON output.`,
                  config: { responseMimeType: 'application/json' }
              });
              const json = parseGeminiJson(res.text || '{}');
              return {
                  possibleQuestions: json.possibleQuestions || [],
                  recommendedTone: json.recommendedTone || 'neutral',
                  reasoning: json.reasoning || 'AI reasoning.'
              };
          } catch (e) {
              return { possibleQuestions: [], recommendedTone: 'neutral', reasoning: 'Hata.' };
          }
      },
      calculateLeadScore: async (lead: Lead): Promise<LeadScoreDetails> => {
          return {
              categoryScores: { website: 0, seo: 0, socialMedia: 0, onlineSystem: 0, contentQuality: 0, competitorGap: 0, sectorUrgency: 0 },
              bonusFactors: {},
              totalScore: 50,
              finalLeadScore: 3,
              digitalWeaknesses: [],
              opportunityAreas: [],
              estimatedConversionProbability: 'Orta',
              reasoning: 'Otomatik skor.',
              lastCalculated: new Date().toISOString()
          };
      },
      analyzePersona: async (lead: Lead): Promise<PersonaAnalysis> => {
          return {
              type: 'Analitik',
              traits: [],
              communicationStyle: 'Net',
              reasoning: 'Varsayılan.'
          };
      }
  },

  system: {
      testApiKey: async (key: string) => {
          try {
              const ai = new GoogleGenAI({ apiKey: key });
              await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'test' });
              return { success: true, message: 'Valid' };
          } catch (e: any) {
              return { success: false, message: e.message };
          }
      }
  },

  setup: {
      generatePackages: async (baseCost: number, margin: number, type: string): Promise<PricingPackage[]> => {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const prompt = `
            Hizmet: ${type}
            Maliyet: ${baseCost} TL
            Kar Marjı: %${margin}
            Buna göre 3 adet fiyatlandırma paketi (Başlangıç, Profesyonel, Premium) oluştur.
            Özellikler listesi, fiyat, maliyet ve kar hesapla.
            JSON döndür: { "packages": [ { "id": "p1", "name": "...", "price": 0, "cost": 0, "profit": 0, "features": [], "description": "" } ] }
          `;
          try {
              const result = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: prompt,
                  config: { responseMimeType: 'application/json' }
              });
              const data = parseGeminiJson(result.text || '{}');
              return data.packages || [];
          } catch (e) {
              return [];
          }
      },
      generateInitialTemplates: async (packages: PricingPackage[]): Promise<EmailTemplate[]> => {
          return [
              {
                  id: 't-intro-1',
                  name: 'Tanışma (Genel)',
                  type: 'intro',
                  subject: '{firma_adi} için Dijital Fırsat',
                  body: 'Merhaba {yetkili},\n\n{ilce} bölgesindeki işletmeleri incelerken sizi gördüm...',
                  isActive: true,
                  useCount: 0,
                  successCount: 0
              }
          ];
      }
  }
};
