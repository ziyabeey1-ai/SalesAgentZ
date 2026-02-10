
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Lead, AgentThought, AgentConfig, EmailTemplate } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { sheetsService } from '../services/googleSheetsService';

export interface AgentNotification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    timestamp: number;
}

interface AgentContextType {
    isAgentRunning: boolean;
    agentStatus: string;
    thoughts: AgentThought[];
    notifications: AgentNotification[];
    pendingDraftsCount: number;
    agentConfig: AgentConfig;
    toggleAgent: () => void;
    dismissNotification: (id: string) => void;
    updateAgentConfig: (config: Partial<AgentConfig>) => void;
    addThought: (type: AgentThought['type'], message: string, metadata?: any) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const AGENT_MODEL = 'gemini-3-flash-preview';
const BURST_INTERVAL = 2000; // Fast burst
const IDLE_INTERVAL = 3000; // Reduced idle time to 3s to keep terminal alive
const MIN_ACTIVE_LEADS = 8;
const MIN_ENRICHMENT_SCORE = 3;
const AGENT_RUNNING_KEY = 'agentRunning';

// PRIORITY DISTRICTS
const PRIORITY_DISTRICTS = ['Bahçeşehir', 'Esenyurt', 'Beylikdüzü'];

const isProspectLead = (lead: Lead): boolean => {
    return lead.lead_durumu === 'aktif' || lead.lead_durumu === 'beklemede';
};

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [agentStatus, setAgentStatus] = useState('Hazır');
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [notifications, setNotifications] = useState<AgentNotification[]>([]);
    const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
    
    // Configuration
    const [agentConfig, setAgentConfig] = useState<AgentConfig>({
        targetDistrict: 'Tümü',
        targetSector: 'Tümü',
        focusMode: 'balanced'
    });
    
    // Refs for loop management
    const configRef = useRef(agentConfig);
    const isRunningRef = useRef(isAgentRunning);
    const enrichmentRetryRef = useRef<Record<string, { attempts: number; nextRetryAt: number }>>({});
    const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const burstStreakRef = useRef(0);

    // Sync refs
    useEffect(() => { configRef.current = agentConfig; }, [agentConfig]);
    useEffect(() => { isRunningRef.current = isAgentRunning; }, [isAgentRunning]);

    // Initialize & Auto-Connect Google Services
    useEffect(() => {
        refreshPendingCount();
        const interval = setInterval(refreshPendingCount, 10000);
        
        // Auto-initialize Google Sheets Service if credentials exist
        const initGoogle = async () => {
            const apiKey = localStorage.getItem('googleApiKey');
            const clientId = localStorage.getItem('clientId');
            if (apiKey && clientId) {
                try {
                    await sheetsService.initialize(apiKey, clientId);
                    console.log("Google Service Auto-Initialized");
                } catch (e) {
                    console.error("Google Service Auto-Init Failed:", e);
                }
            }
        };
        initGoogle();

        return () => clearInterval(interval);
    }, []);

    // Restore running state
    useEffect(() => {
        const wasRunning = localStorage.getItem(AGENT_RUNNING_KEY) === 'true';
        if (wasRunning) {
            setIsAgentRunning(true);
            localStorage.setItem(AGENT_RUNNING_KEY, 'true');
            setAgentStatus('Başlatılıyor...');
            if (sessionStorage.getItem('agentRestoreNotified') !== 'true') {
                addThought('info', 'Otopilot oturumu geri yüklendi.');
                sessionStorage.setItem('agentRestoreNotified', 'true');
            }
            setTimeout(agentLoop, 1000); // Increased initial delay to prevent race condition on load
        }

        return () => {
            if (loopTimeoutRef.current) {
                clearTimeout(loopTimeoutRef.current);
            }
        };
    }, []);

    const refreshPendingCount = async () => {
        try {
            const leads = await api.leads.getAll();
            const count = leads.filter(l => l.lead_durumu === 'onay_bekliyor').length;
            setPendingDraftsCount(count);
        } catch (e) {
            console.error('Pending count refresh error', e);
        }
    };

    const addThought = (type: AgentThought['type'], message: string, metadata?: any) => {
        const newThought: AgentThought = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type,
            message,
            metadata
        };
        setThoughts(prev => [...prev, newThought].slice(-50)); // Keep last 50
    };

    const addNotification = (title: string, message: string, type: AgentNotification['type']) => {
        const newNotif: AgentNotification = {
            id: Math.random().toString(36).substr(2, 9),
            title,
            message,
            type,
            timestamp: Date.now()
        };
        setNotifications(prev => [newNotif, ...prev]);
        setTimeout(() => dismissNotification(newNotif.id), 5000);
    };

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const stopAgentSafely = (reason: string) => {
        setIsAgentRunning(false);
        localStorage.setItem(AGENT_RUNNING_KEY, 'false');
        setAgentStatus('Durduruldu (Bütçe)');
        addThought('error', reason);
        addNotification('Ajan Durduruldu', reason, 'warning');
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };

    const toggleAgent = () => {
        if (isAgentRunning) {
            setIsAgentRunning(false);
            localStorage.setItem(AGENT_RUNNING_KEY, 'false');
            setAgentStatus('Durduruldu');
            sessionStorage.removeItem('agentRestoreNotified');
            addThought('info', 'Otopilot kullanıcı tarafından durduruldu.');
            if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
        } else {
            setIsAgentRunning(true);
            localStorage.setItem(AGENT_RUNNING_KEY, 'true');
            setAgentStatus('Başlatılıyor...');
            addThought('info', 'Otopilot başlatıldı.');
            setTimeout(agentLoop, 100);
        }
    };

    const updateAgentConfig = (config: Partial<AgentConfig>) => {
        setAgentConfig(prev => ({ ...prev, ...config }));
    };

    // --- AGENT LOGIC HELPER ---

    const getAiClient = () => {
        const key = localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey') || '';
        if (!key) throw new Error("API Key eksik");
        return new GoogleGenAI({ apiKey: key });
    };

    const checkAndIncrementCost = () => {
        const usage = storage.getUsage();
        // Check financial limit instead of raw count
        if (usage.estimatedCost >= usage.dailyLimit) {
            if (isRunningRef.current) {
                stopAgentSafely(`Günlük bütçe ($${usage.dailyLimit}) dolduğu için işlem durduruldu.`);
            }
            return false;
        }
        storage.incrementUsage('ai');
        return true;
    };

    const extractGeminiText = (response: any): string => {
        return response.text || '';
    };

    const parseGeminiJson = (text: string) => {
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            // Safe parsing for empty response
            if (!clean) return {};
            return JSON.parse(clean);
        } catch (e) {
            console.error("JSON Parse Error", e);
            return {};
        }
    };

    const isBusinessHours = (): boolean => {
        // DEMO MODU: Her zaman açık (Gece vardiyası kısıtlaması kaldırıldı)
        // Kullanıcı testi için 7/24 aktif çalışır.
        return true;
        
        /* Orijinal Mesai Mantığı (Production için açılabilir)
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        // Cumartesi Pazar da çalışmasın
        if (day === 0 || day === 6) return false;
        return hour >= 9 && hour < 18;
        */
    };

    const isFollowupDue = (lead: Lead): boolean => {
        if (!lead.son_kontakt_tarihi) return true;
        const lastContact = new Date(lead.son_kontakt_tarihi);
        if (Number.isNaN(lastContact.getTime())) return true;
        const now = new Date();
        const diffMs = now.getTime() - lastContact.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 1;
    };

    // --- ACTIONS ---

    // NEW: Lead Sanitization Action (Maintenance) - PRIORITY #1
    // This is FREE (does not consume credits) and runs in batch.
    const performLeadSanitization = async (leads: Lead[]): Promise<boolean> => {
        // Find leads with invalid data that are marked as 'active' or 'waiting'
        const dirtyLeads = leads.filter(l => {
            const hasEmail = !!l.email;
            const isInvalidEmail = hasEmail && (!l.email.includes('@') || l.email.length < 5 || l.email.includes('null') || l.email.includes('undefined') || l.email === 'info@firma.com');
            // If it has email but it's clearly garbage, OR if it has NO contact info at all and isn't new (no email AND no phone)
            const isDead = (!l.email && !l.telefon) && l.lead_durumu !== 'gecersiz';
            
            return (isProspectLead(l) && isInvalidEmail) || isDead;
        }).slice(0, 3); // Process up to 3 at a time to speed up

        if (dirtyLeads.length > 0) {
            for (const dirtyLead of dirtyLeads) {
                const updatedLead = { 
                    ...dirtyLead, 
                    lead_durumu: 'gecersiz' as any, 
                    notlar: dirtyLead.notlar + '\n[Sistem]: Geçersiz iletişim bilgisi (Oto-Temizlik).' 
                };
                await api.leads.update(updatedLead);
            }
            
            setAgentStatus(`Veri Temizliği: ${dirtyLeads.length} lead arşivlendi.`);
            addThought('decision', `${dirtyLeads.map(l => l.firma_adi).join(', ')} temizlendi.`);
            return true;
        }
        return false;
    };

    const performAutoReplyDrafting = async (leads: Lead[], draftOnly: boolean = false): Promise<boolean> => {
        const targets = leads.filter(l => 
            (l.lead_durumu === 'takipte' || l.lead_durumu === 'teklif_gonderildi') &&
            !l.draftResponse && 
            isFollowupDue(l)
        );
        
        if (targets.length === 0) return false;
        const lead = targets[0]; // Process one at a time

        if (!checkAndIncrementCost()) return false;
        
        setAgentStatus(`Yanıt Taslağı: ${lead.firma_adi}`);
        addThought('action', `${lead.firma_adi} için olası sorulara yanıt taslağı hazırlanıyor.`);

        try {
            const result = await api.strategy.predictNextMove(lead);
            
            // Safer access to possibleQuestions
            const possibleQuestions = Array.isArray(result?.possibleQuestions) ? result.possibleQuestions : [];
            const draftContent = possibleQuestions[0]?.responses?.neutral || "Merhaba, detayları konuşmak isteriz.";
            const draftSubject = `Re: ${lead.firma_adi} Dijital Çözümler`;

            const updatedLead: Lead = {
                ...lead,
                draftResponse: {
                    subject: draftSubject,
                    body: draftContent,
                    intent: 'auto_draft',
                    created_at: new Date().toISOString()
                },
                lead_durumu: 'onay_bekliyor'
            };

            // If we are allowed to send (business hours) AND email exists
            if (!draftOnly && lead.email) {
                const response = await api.gmail.send(lead.email, draftSubject, draftContent);
                await api.leads.logInteraction(lead.id, 'email', `Otomatik takip yanıtı: ${draftSubject}`);
                await api.leads.update({
                    ...lead,
                    lead_durumu: 'takipte',
                    son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                    draftResponse: undefined
                });
                await api.dashboard.logAction('Otomatik Yanıt', `${lead.firma_adi} için takip yanıtı gönderildi.`, 'success');
                
                if (response._status === 'mock') {
                    addThought('warning', `[SİMÜLASYON] ${lead.firma_adi} yanıtı gönderildi (Gerçek gönderim için Ayarlar'dan Google'a bağlanın).`);
                } else {
                    addThought('success', `Otomatik yanıt gönderildi: ${lead.firma_adi}`);
                }
                return true;
            }

            // Otherwise, just save as draft
            await api.leads.update(updatedLead);
            addThought('info', `${lead.firma_adi} için yanıt taslağı hazırlandı ve onaya sunuldu (Gönderilmedi).`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const performAutoEnrichment = async (leads: Lead[]): Promise<boolean> => {
        const { targetDistrict, targetSector } = configRef.current;
        const now = Date.now();

        const candidates = leads.filter(l => 
            isProspectLead(l) && 
            (!l.email) && 
            l.lead_skoru >= MIN_ENRICHMENT_SCORE &&
            (targetDistrict === 'Tümü' || l.ilce === targetDistrict) &&
            (targetSector === 'Tümü' || l.sektor === targetSector)
        );

        const readyCandidates = candidates.filter((lead) => {
            const retryState = enrichmentRetryRef.current[lead.id];
            return !retryState || retryState.nextRetryAt <= now;
        });

        const target = readyCandidates[0];
        if (!target) return false;

        if (!checkAndIncrementCost()) return false;

        setAgentStatus(`${target.firma_adi} verileri zenginleştiriliyor...`);
        addThought('action', `${target.firma_adi} için iletişim bilgisi (Email) aranıyor.`);

        try {
            const ai = getAiClient();
            const prompt = `
              SİSTEM ROLÜ: B2B veri zenginleştirme uzmanı.
              HEDEF: ${target.firma_adi} (${target.ilce}, ${target.sektor})
              GÖREV: Web'de kurumsal email adresi bul.
              
              ⚠️ KRİTİK:
              - Asla tahmin yürütme (örn: info@... gibi uydurma).
              - Sadece %100 emin olduğun, kaynakta geçen mailleri getir.
              - Bulamazsan boş döndür.
              
              JSON: { "email": "...", "confidence": "high/medium/low", "source": "..." }
            `;

            const result = await ai.models.generateContent({
              model: AGENT_MODEL,
              contents: prompt,
              config: { 
                  tools: [{ googleSearch: {} }],
                  responseMimeType: 'application/json' 
              }
            });
            
            const data = parseGeminiJson(extractGeminiText(result) || '{}');
            
            // STRICT FILTERING: No 'example.com', no null strings, must have @
            if (data.email && data.email.includes('@') && !data.email.includes('null') && !data.email.includes('example.com')) {
                const updatedLead = {
                    ...target,
                    email: data.email,
                    eksik_alanlar: target.eksik_alanlar.filter(f => f !== 'email'),
                    lead_skoru: target.lead_skoru + 2,
                    notlar: target.notlar ? `${target.notlar}\n[AI]: Email bulundu (${data.source})` : `[AI]: Email bulundu (${data.source})`
                };
                await api.leads.update(updatedLead);
                delete enrichmentRetryRef.current[target.id];
                addThought('success', `${target.firma_adi} email bulundu: ${data.email}`);
                return true;
            } else {
                const prevState = enrichmentRetryRef.current[target.id];
                const attempts = (prevState?.attempts || 0) + 1;
                
                // CRITICAL FIX: If we tried 3 times and failed, mark as INVALID to stop blocking the pipeline
                if (attempts >= 3) {
                    const updatedLead: Lead = {
                        ...target,
                        lead_durumu: 'gecersiz',
                        notlar: target.notlar ? `${target.notlar}\n[AI]: 3 denemede email bulunamadı.` : `[AI]: 3 denemede email bulunamadı.`
                    };
                    await api.leads.update(updatedLead);
                    delete enrichmentRetryRef.current[target.id];
                    addThought('warning', `${target.firma_adi} pasife alındı (Email bulunamadı).`);
                    return true; // We return true to indicate action taken (pipeline updated)
                }

                const cooldownMs = Math.min(60 * 60 * 1000, Math.pow(2, attempts) * 5 * 60 * 1000); 
                enrichmentRetryRef.current[target.id] = { attempts, nextRetryAt: Date.now() + cooldownMs };
                addThought('decision', `${target.firma_adi} için email bulunamadı. (${attempts}/3).`);
                
                // Return true so we don't stall. We "acted" by trying to enrich.
                return true;
            }
        } catch (e) {
            console.error("Enrichment error", e);
        }
        return false;
    };

    const performSmartDiscovery = async (leads: Lead[]) => {
        // FIX: Check Actionable Leads (With Email) instead of just raw count
        const actionableLeads = leads.filter(l => isProspectLead(l) && l.email && !l.son_kontakt_tarihi).length;
        const totalActive = leads.filter(isProspectLead).length;

        // If we have enough actionable leads, skip discovery to save credits/time
        if (actionableLeads >= 5) {
            return false;
        }

        // INCREASED LIMIT: Allow pipeline to hold more leads (up to 50) before stopping discovery
        if (totalActive > 50) {
            // Wait silently without notification spam
            return false;
        }

        if (!checkAndIncrementCost()) return false;

        const { targetDistrict, targetSector } = configRef.current;
        
        // --- PRIORITY LOGIC ---
        let district = targetDistrict;
        if (targetDistrict === 'Tümü') {
            // Pick a priority district randomly to focus the search
            district = PRIORITY_DISTRICTS[Math.floor(Math.random() * PRIORITY_DISTRICTS.length)];
        }
        
        const sector = targetSector === 'Tümü' ? 'Diğer' : targetSector;

        setAgentStatus('Pipeline besleniyor: Yeni fırsatlar aranıyor...');
        addThought('action', `${district} bölgesinde ${sector} için nitelikli (maili olan) lead aranıyor.`);

        try {
            const discoveredLeads = await api.leads.discover(sector, district);

            if (discoveredLeads.length === 0) {
                addThought('decision', 'Arama yapıldı ancak uygun lead bulunamadı.');
                return false;
            }

            const existingNameSet = new Set(leads.map(l => l.firma_adi.toLowerCase()));
            let addedCount = 0;

            for (const newLead of discoveredLeads) {
                if (existingNameSet.has(newLead.firma_adi.toLowerCase())) continue;

                await api.leads.create(newLead);
                await api.dashboard.logAction('Otonom Lead Keşfi', `${newLead.firma_adi} eklendi`, 'success');
                existingNameSet.add(newLead.firma_adi.toLowerCase());
                addedCount += 1;
            }

            if (addedCount > 0) {
                addThought('success', `Pipeline güncellendi: ${addedCount} yeni lead eklendi.`);
                return true;
            }

            addThought('decision', 'Bulunan leadler zaten sistemde mevcut.');
        } catch (e) {
            console.error('Discovery error', e);
            addThought('error', 'Otonom keşif sırasında hata oluştu.');
        }
        return false;
    };

    const performOutreach = async (leads: Lead[]) => {
        const pendingQueue = leads.filter(l => isProspectLead(l) && l.email && !l.son_kontakt_tarihi);
        if (pendingQueue.length === 0) return false;

        const templates = await api.templates.getAll();
        const templateList = Array.isArray(templates) ? templates : [];
        const activeIntroTemplates = templateList.filter(t => t.type === 'intro' && t.isActive);
        const lead = pendingQueue.sort((a, b) => b.lead_skoru - a.lead_skoru)[0];

        if (activeIntroTemplates.length === 0) {
            addThought('info', 'Aktif intro şablonu bulunamadı, AI ile anlık outreach oluşturuluyor.');
            try {
                const generated = await api.templates.generateColdEmail(lead);
                // generated content is already cleaned by api.ts before return
                
                const subject = generated.subject || `${lead.firma_adi} için kısa bir tanışma`;
                const body = generated.body || `Merhaba ${lead.yetkili_adi || 'Yetkili'}, ${lead.firma_adi} için dijital büyüme fırsatlarını konuşabilir miyiz?`;

                if (!checkAndIncrementCost()) return false;

                const response = await api.gmail.send(lead.email, subject, body);
                await api.leads.logInteraction(lead.id, 'email', `Otomatik outreach (AI): ${subject}`);
                await api.leads.update({
                    ...lead,
                    lead_durumu: 'takipte',
                    son_kontakt_tarihi: new Date().toISOString().slice(0, 10)
                });
                await api.dashboard.logAction('Otomatik Outreach', `${lead.firma_adi} için AI üretimli intro mail gönderildi.`, 'success');
                
                if (response._status === 'mock') {
                    addThought('warning', `[SİMÜLASYON] ${lead.firma_adi} için AI maili simüle edildi (Google bağlantısı yok).`);
                } else {
                    addThought('success', `${lead.firma_adi} için AI üretimli intro mail gönderildi.`);
                }
                return true;
            } catch (e) {
                console.error('Outreach fallback error', e);
                addThought('error', `${lead.firma_adi} için AI outreach üretilemedi.`);
                return false;
            }
        }

        const getTemplateScore = (template: any) => {
            if (typeof template.performanceScore === 'number') return template.performanceScore;
            if (template.useCount > 0) return Math.round((template.successCount / template.useCount) * 100);
            return 0;
        };

        const bestTemplate = [...activeIntroTemplates].sort((a, b) => getTemplateScore(b) - getTemplateScore(a))[0];

        // --- FIXED: Read Company Name from storage profile properly ---
        // Also refetch profile to ensure we have latest data
        const userProfile = storage.getUserProfile();
        const myName = userProfile.fullName || 'Satış Temsilcisi';
        const myCompany = userProfile.companyName || 'Ajansımız';
        
        const replacements: Record<string, string> = {
            '{firma_adi}': lead.firma_adi,
            '{yetkili}': lead.yetkili_adi || 'Yetkili',
            '{sektor}': lead.sektor,
            '{ilce}': lead.ilce,
            '{ajans_adi}': myCompany,
            // Handle square brackets just in case
            '\\[Şirket Adı\\]': lead.firma_adi,
            '\\[Firma Adı\\]': lead.firma_adi,
            '\\[İsim\\]': lead.yetkili_adi || 'Yetkili',
            '\\[Kendi Şirket Adınız\\]': myCompany,
            '\\[Şirket Adınız\\]': myCompany,
            '\\[Senin Adın\\]': myName,
            '\\[Adınız\\]': myName
        };

        const applyTemplate = (content: string) => {
            let result = content;
            Object.entries(replacements).forEach(([key, value]) => {
                // If key starts with \[ it's already regex escaped, otherwise escape it
                const regexKey = key.startsWith('\\') ? key : key.replace(/[{}]/g, '\\$&');
                result = result.replace(new RegExp(regexKey, 'gi'), value);
            });
            return result;
        };

        const subject = applyTemplate(bestTemplate.subject);
        const body = applyTemplate(bestTemplate.body);

        if (!checkAndIncrementCost()) return false;

        setAgentStatus(`Outreach gönderiliyor: ${lead.firma_adi}`);
        addThought('action', `${lead.firma_adi} için intro maili gönderiliyor.`);

        try {
            const response = await api.gmail.send(lead.email, subject, body);
            await api.leads.logInteraction(lead.id, 'email', `Otomatik outreach: ${subject}`);
            await api.leads.update({
                ...lead,
                lead_durumu: 'takipte',
                son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                lastUsedTemplateId: bestTemplate.id
            });
            await api.dashboard.logAction('Otomatik Outreach', `${lead.firma_adi} için intro mail gönderildi.`, 'success');
            
            if (response._status === 'mock') {
                addThought('warning', `[SİMÜLASYON] ${lead.firma_adi} için mail gönderildi (Gerçek gönderim için Google Girişi yapın).`);
            } else {
                addThought('success', `${lead.firma_adi} için intro maili başarıyla gönderildi.`);
            }
            return true;
        } catch (e) {
            console.error('Outreach error', e);
            addThought('error', `${lead.firma_adi} için outreach gönderimi başarısız.`);
            return false;
        }
    };

    // --- MAIN LOOP ---

    const agentLoop = async () => {
        // Critical safety check at start of loop
        if (!isRunningRef.current) {
            localStorage.setItem(AGENT_RUNNING_KEY, 'false');
            return;
        }

        try {
            const leads = await api.leads.getAll();
            let actionTaken = false;
            const isDaytime = isBusinessHours();

            // --- PRIORITY 1: MAINTENANCE & CLEANUP (Safe 24/7, FREE) ---
            if (!actionTaken) actionTaken = await performLeadSanitization(leads);

            // --- PRIORITY 2: ENRICHMENT (Safe 24/7) ---
            // Find emails for existing leads
            if (!actionTaken) actionTaken = await performAutoEnrichment(leads);

            // --- PRIORITY 3: DISCOVERY (Safe 24/7) ---
            // Refill pipeline if low
            if (!actionTaken) actionTaken = await performSmartDiscovery(leads);

            // --- PRIORITY 4: ACTIVE COMMUNICATION (Now 24/7 Enabled) ---
            if (isDaytime) {
                if (!actionTaken) actionTaken = await performAutoReplyDrafting(leads, false); // Send allowed
                if (!actionTaken) actionTaken = await performOutreach(leads);
            } else {
                // If isDaytime logic was kept, this would be Night Mode (Draft only)
                // But with isBusinessHours returning true, this block is unreachable in default setup.
                if (!actionTaken) actionTaken = await performAutoReplyDrafting(leads, true); 
            }

            if (actionTaken) {
                burstStreakRef.current += 1;
                
                // --- FIX: AUTO RESUME MECHANISM ---
                if (burstStreakRef.current > 30) {
                    setAgentStatus("Aşırı yüklenme algılandı. Soğuma modu aktif (1dk)...");
                    addThought('warning', "İşlem yoğunluğu çok yüksek. Sistem kendini 60 saniye soğumaya alıyor...");
                    
                    setTimeout(() => {
                        burstStreakRef.current = 0;
                        if (isRunningRef.current) {
                            addThought('info', "Soğuma tamamlandı. Otopilot tekrar devreye giriyor.");
                            agentLoop();
                        }
                    }, 60000); 
                    return; 
                }

                setAgentStatus(`Aktif İşlem (x${burstStreakRef.current})...`);
                loopTimeoutRef.current = setTimeout(agentLoop, BURST_INTERVAL);
            } else {
                setAgentStatus('Beklemede (Taranıyor)...');
                burstStreakRef.current = 0;
                // Fast recovery loop to check for new tasks
                loopTimeoutRef.current = setTimeout(agentLoop, IDLE_INTERVAL);
            }

        } catch (error: any) {
            console.error("Agent Loop Critical Error", error);
            // Don't kill the agent on error, just pause and retry
            addThought('error', `Geçici Hata: ${error.message || 'Bilinmeyen hata'}. Yeniden deneniyor...`);
            setTimeout(agentLoop, 15000);
        }
    };

    return (
        <AgentContext.Provider value={{
            isAgentRunning,
            agentStatus,
            thoughts,
            notifications,
            pendingDraftsCount,
            agentConfig,
            toggleAgent,
            dismissNotification,
            updateAgentConfig,
            addThought
        }}>
            {children}
        </AgentContext.Provider>
    );
};

export const useAgent = () => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
};
