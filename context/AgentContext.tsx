
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Lead, AgentThought, AgentConfig, EmailTemplate } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';

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
// OPTIMIZATION: Adaptive timing constants
const IDLE_INTERVAL = 60000; // 60 sec when nothing is happening
const BUSY_INTERVAL = 5000;  // 5 sec when acting ("Burst Mode")
const MIN_ACTIVE_LEADS = 8;
const MIN_ENRICHMENT_SCORE = 3;

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

    // Initialize
    useEffect(() => {
        refreshPendingCount();
        const interval = setInterval(refreshPendingCount, 10000);
        return () => clearInterval(interval);
    }, []);

    const refreshPendingCount = async () => {
        const leads = await api.leads.getAll();
        const count = leads.filter(l => l.lead_durumu === 'onay_bekliyor').length;
        setPendingDraftsCount(count);
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

    const toggleAgent = () => {
        if (isAgentRunning) {
            setIsAgentRunning(false);
            setAgentStatus('Durduruldu');
            addThought('info', 'Otopilot kullanıcı tarafından durduruldu.');
            if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
        } else {
            setIsAgentRunning(true);
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
                setIsAgentRunning(false);
                setAgentStatus('Limit Aşıldı');
                addNotification('Otopilot Durdu', 'Günlük AI işlem limitine ulaşıldı.', 'error');
                addThought('error', 'Günlük limit dolduğu için işlem durduruldu.');
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
        
        // Weekend check (Sunday=0, Saturday=6)
        if (day === 0 || day === 6) return false;
        
        // Hours check (09:00 - 18:00)
        return hour >= 9 && hour < 18;
    };

    // --- ACTIONS ---

    const performAutoReplyDrafting = async (leads: Lead[]): Promise<boolean> => {
        const targets = leads.filter(l => 
            (l.lead_durumu === 'takipte' || l.lead_durumu === 'teklif_gonderildi') &&
            !l.draftResponse
        );
        
        if (targets.length === 0) return false;
        const lead = targets[0]; // Process one at a time

        if (!checkAndIncrementCost()) return false;
        
        setAgentStatus(`Yanıt Taslağı: ${lead.firma_adi}`);
        addThought('action', `${lead.firma_adi} için olası sorulara yanıt taslağı hazırlanıyor.`);

        try {
            const result = await api.strategy.predictNextMove(lead);
            
            // Create a draft based on the 'neutral' tone prediction
            const draftContent = result.possibleQuestions[0]?.responses.neutral || "Merhaba, detayları konuşmak isteriz.";
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

            await api.leads.update(updatedLead);
            addThought('success', `Taslak oluşturuldu: ${lead.firma_adi}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const performAutoEnrichment = async (leads: Lead[]): Promise<boolean> => {
        const { targetDistrict, targetSector } = configRef.current;
        const now = Date.now();

        // Only enrich active leads with high score but missing info
        const candidates = leads.filter(l => 
            l.lead_durumu === 'aktif' && 
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
              KURALLAR: 
              - Sadece info@, iletisim@, satis@ vb. kurumsal mailler.
              - Gmail/Hotmail kabul etme.
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
                    lead_skoru: target.lead_skoru + 2, // Bonus for finding email
                    notlar: target.notlar ? `${target.notlar}\n[AI]: Email bulundu (${data.source})` : `[AI]: Email bulundu (${data.source})`
                };
                await api.leads.update(updatedLead);
                delete enrichmentRetryRef.current[target.id];
                addThought('success', `${target.firma_adi} email bulundu: ${data.email}`);
                return true;
            } else {
                const prevState = enrichmentRetryRef.current[target.id];
                const attempts = (prevState?.attempts || 0) + 1;
                const cooldownMs = Math.min(60 * 60 * 1000, Math.pow(2, attempts) * 5 * 60 * 1000); // Backoff
                enrichmentRetryRef.current[target.id] = { attempts, nextRetryAt: Date.now() + cooldownMs };
                addThought('decision', `${target.firma_adi} için email bulunamadı. Pas geçiliyor.`);
            }
        } catch (e) {
            console.error("Enrichment error", e);
        }
        return false;
    };

    const performSmartDiscovery = async (leads: Lead[]) => {
        if (leads.filter(l => l.lead_durumu === 'aktif').length >= MIN_ACTIVE_LEADS) {
            return false;
        }

        if (!checkAndIncrementCost()) return false;

        const { targetDistrict, targetSector } = configRef.current;
        const district = targetDistrict === 'Tümü' ? 'Kadıköy' : targetDistrict;
        const sector = targetSector === 'Tümü' ? 'Diğer' : targetSector;

        setAgentStatus('Yeni fırsatlar keşfediliyor...');
        addThought('action', `${district} bölgesinde ${sector} için otonom lead keşfi başlatıldı.`);

        try {
            const ai = getAiClient();
            const prompt = `
              SİSTEM ROLÜ: B2B Lead Avcısı.
              GÖREV: İstanbul ${district} bölgesinde ${sector} sektöründe 3 adet işletme bul.
              KURALLAR:
              - Sadece kurumsal email içeren işletmeler.
              - Mümkünse telefonu da ekle.
              - ÇIKTI SADECE JSON.
              JSON:
              {
                "leads": [
                  {
                    "firma_adi": "...",
                    "email": "info@...",
                    "telefon": "...",
                    "adres": "...",
                    "web_sitesi_durumu": "Var|Yok|Kötü",
                    "firsat_nedeni": "..."
                  }
                ]
              }
            `;

            const result = await ai.models.generateContent({
                model: AGENT_MODEL,
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json'
                }
            });

            const parsed = parseGeminiJson(extractGeminiText(result) || '{}');
            const discoveredLeads = Array.isArray(parsed?.leads) ? parsed.leads : [];

            if (discoveredLeads.length === 0) {
                addThought('decision', 'Otonom keşifte uygun lead bulunamadı.');
                return false;
            }

            const existingNameSet = new Set(leads.map(l => l.firma_adi.toLowerCase()));
            let addedCount = 0;

            for (const item of discoveredLeads) {
                if (!item?.email || !String(item.email).includes('@')) continue;
                const firmName = String(item.firma_adi || '').trim();
                if (!firmName) continue;
                if (existingNameSet.has(firmName.toLowerCase())) continue;

                const newLead: Lead = {
                    id: Math.random().toString(36).substr(2, 9),
                    firma_adi: firmName,
                    sektor: sector,
                    ilce: district,
                    adres: item.adres || district,
                    telefon: item.telefon || '',
                    email: item.email,
                    kaynak: 'AI Asistan',
                    websitesi_var_mi: item.web_sitesi_durumu === 'Yok' ? 'Hayır' : 'Evet',
                    lead_durumu: 'aktif',
                    lead_skoru: item.web_sitesi_durumu === 'Kötü' ? 4 : (item.web_sitesi_durumu === 'Yok' ? 3 : 2),
                    eksik_alanlar: item.telefon ? [] : ['telefon'],
                    notlar: `[Otonom Keşif]
${item.firsat_nedeni || 'AI keşfi ile eklendi.'}`
                };

                await api.leads.create(newLead);
                await api.dashboard.logAction('Otonom Lead Keşfi', `${newLead.firma_adi} eklendi`, 'success');
                existingNameSet.add(firmName.toLowerCase());
                addedCount += 1;
            }

            if (addedCount > 0) {
                addThought('success', `Otonom keşif tamamlandı: ${addedCount} yeni lead eklendi.`);
                return true;
            }

            addThought('decision', 'Keşif tamamlandı ancak eklenebilir yeni lead bulunamadı.');
        } catch (e) {
            console.error('Discovery error', e);
            addThought('error', 'Otonom keşif sırasında hata oluştu.');
        }
        return false;
    };

    const performOutreach = async (leads: Lead[]): Promise<boolean> => {
        // Find leads ready for first contact: Active, Has Email, No Contact Date
        const pendingQueue = leads.filter(l => l.lead_durumu === 'aktif' && l.email && !l.son_kontakt_tarihi);
        if (pendingQueue.length === 0) return false;

        const templates = await api.templates.getAll();
        const activeIntroTemplates = templates.filter(t => t.type === 'intro' && t.isActive);
        if (activeIntroTemplates.length === 0) {
            addThought('warning', 'Aktif intro şablonu bulunamadı, outreach atlandı.');
            return false;
        }

        const getTemplateScore = (template: any) => {
            if (typeof template.performanceScore === 'number') return template.performanceScore;
            if (template.useCount > 0) return Math.round((template.successCount / template.useCount) * 100);
            return 0;
        };

        const bestTemplate = [...activeIntroTemplates].sort((a, b) => getTemplateScore(b) - getTemplateScore(a))[0];
        const lead = pendingQueue.sort((a, b) => b.lead_skoru - a.lead_skoru)[0];

        const replacements: Record<string, string> = {
            '{firma_adi}': lead.firma_adi,
            '{yetkili}': lead.yetkili_adi || 'Yetkili',
            '{sektor}': lead.sektor,
            '{ilce}': lead.ilce,
            '{ajans_adi}': localStorage.getItem('companyName') || 'Ajansımız'
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
            await api.gmail.send(lead.email, subject, body);
            await api.leads.logInteraction(lead.id, 'email', `Otomatik outreach: ${subject}`);
            await api.leads.update({
                ...lead,
                lead_durumu: 'takipte',
                son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
                lastUsedTemplateId: bestTemplate.id
            });
            await api.dashboard.logAction('Otomatik Outreach', `${lead.firma_adi} için intro mail gönderildi.`, 'success');
            addThought('success', `${lead.firma_adi} için intro maili başarıyla gönderildi.`);
            return true;
        } catch (e) {
            console.error('Outreach error', e);
            addThought('error', `${lead.firma_adi} için outreach gönderimi başarısız.`);
            return false;
        }
    };

    // --- MAIN LOOP ---

    const agentLoop = async () => {
        if (!isRunningRef.current) return;

        try {
            const leads = await api.leads.getAll();
            let actionTaken = false;

            // PRIORITY 1: Reply Drafting (High Value)
            if (!actionTaken) actionTaken = await performAutoReplyDrafting(leads);

            // PRIORITY 2: Outreach (Business Hours Only - Revenue Driver)
            if (!actionTaken && isBusinessHours()) {
                // Check if we have leads ready for contact
                actionTaken = await performOutreach(leads);
            }

            // PRIORITY 3: Enrichment (Quality Assurance)
            if (!actionTaken) actionTaken = await performAutoEnrichment(leads);

            // PRIORITY 4: Discovery (Pipeline Refill)
            if (!actionTaken) actionTaken = await performSmartDiscovery(leads);

            if (actionTaken) {
                // BURST MODE: If we did something, do the next thing fast!
                burstStreakRef.current += 1;
                setAgentStatus(`Burst Mode x${burstStreakRef.current}: İşlem tamamlandı, yeni tur hazırlanıyor...`);
                loopTimeoutRef.current = setTimeout(agentLoop, BUSY_INTERVAL);
            } else {
                // IDLE MODE: Sleep to save cost/cpu
                setAgentStatus(isBusinessHours() ? 'Beklemede (İzleniyor)' : 'Mesai Dışı (Uyku Modu)');
                burstStreakRef.current = 0;
                loopTimeoutRef.current = setTimeout(agentLoop, IDLE_INTERVAL);
            }

        } catch (error) {
            console.error("Agent Loop Error", error);
            addThought('error', 'Döngü hatası, sistem beklemeye alındı.');
            burstStreakRef.current = 0;
            loopTimeoutRef.current = setTimeout(agentLoop, IDLE_INTERVAL);
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
