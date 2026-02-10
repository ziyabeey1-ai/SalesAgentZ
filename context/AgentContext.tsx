
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
const BURST_INTERVAL = 3000; // Faster burst
const IDLE_INTERVAL = 10000; // Reduced idle time to 10s for faster recovery
const MIN_ACTIVE_LEADS = 8;
const MIN_ENRICHMENT_SCORE = 3;
const AGENT_RUNNING_KEY = 'agentRunning';

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
        setAgentStatus('Durduruldu (Hata)');
        addThought('error', reason);
        addNotification('Ajan Durduruldu', reason, 'error');
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
        if (usage.aiCalls >= usage.dailyLimit) {
            if (isRunningRef.current) {
                stopAgentSafely('Günlük limit dolduğu için işlem durduruldu.');
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
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        if (day === 0 || day === 6) return false;
        return hour >= 9 && hour < 18;
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

    const performAutoReplyDrafting = async (leads: Lead[]): Promise<boolean> => {
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

            if (lead.email) {
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

            await api.leads.update(updatedLead);
            addThought('warning', `${lead.firma_adi} email olmadığı için taslak onaya bırakıldı.`);
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
              GÖREV: Kurumsal email adresi bul.
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
            
            if (data.email && data.email.includes('@') && !data.email.includes('null')) {
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

        // If we have enough actionable leads, skip discovery
        if (actionableLeads >= 3) {
            return false;
        }

        // INCREASED LIMIT: Allow pipeline to hold more leads (up to 40) before stopping discovery
        if (totalActive > 40) {
            addThought('warning', 'Boru hattında çok fazla e-postasız lead var. Keşif duraklatıldı.');
            return false;
        }

        if (!checkAndIncrementCost()) return false;

        const { targetDistrict, targetSector } = configRef.current;
        const district = targetDistrict === 'Tümü' ? 'Kadıköy' : targetDistrict;
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
        const userProfile = storage.getUserProfile();
        
        const replacements: Record<string, string> = {
            '{firma_adi}': lead.firma_adi,
            '{yetkili}': lead.yetkili_adi || 'Yetkili',
            '{sektor}': lead.sektor,
            '{ilce}': lead.ilce,
            '{ajans_adi}': userProfile.companyName || 'Ajansımız'
        };

        const applyTemplate = (content: string) => {
            let result = content;
            Object.entries(replacements).forEach(([key, value]) => {
                result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
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

            // PRIORITY 1: Reply Drafting
            if (!actionTaken) actionTaken = await performAutoReplyDrafting(leads);

            // PRIORITY 2: Outreach (Fully Autonomous)
            if (!actionTaken) {
                actionTaken = await performOutreach(leads);
            }

            // PRIORITY 3: Enrichment (High Score Leads)
            if (!actionTaken) actionTaken = await performAutoEnrichment(leads);

            // PRIORITY 4: Discovery (Pipeline Refill)
            if (!actionTaken) actionTaken = await performSmartDiscovery(leads);

            if (actionTaken) {
                burstStreakRef.current += 1;
                setAgentStatus(`Burst Mode x${burstStreakRef.current}: İşlem tamamlandı, yeni tur hazırlanıyor...`);
                // Safety clamp on burst streak to prevent infinite rapid loops if something is stuck
                if (burstStreakRef.current > 50) {
                    stopAgentSafely("Aşırı işlem yükü algılandı (Burst Limit). Güvenlik için durduruldu.");
                    return;
                }
                loopTimeoutRef.current = setTimeout(agentLoop, BURST_INTERVAL);
            } else {
                setAgentStatus(isBusinessHours() ? 'Analiz Ediliyor... (Uygun Aksiyon Yok)' : 'Mesai Dışı (Uyku Modu)');
                burstStreakRef.current = 0;
                loopTimeoutRef.current = setTimeout(agentLoop, IDLE_INTERVAL);
            }

        } catch (error: any) {
            console.error("Agent Loop Critical Error", error);
            stopAgentSafely(`Kritik hata: ${error.message || 'Bilinmeyen hata'}`);
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
