
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Lead, AgentThought, AgentConfig } from '../types';
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
// OPTIMIZATION: Loop interval increased to 2 minutes to save costs
const CYCLE_INTERVAL = 120000; 
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
        // Only run if pipeline is drying up
        if (leads.filter(l => l.lead_durumu === 'aktif').length >= MIN_ACTIVE_LEADS) {
            return false;
        }

        if (!checkAndIncrementCost()) return false;

        setAgentStatus('Yeni fırsatlar keşfediliyor...');
        addThought('action', 'Lead sayısı azaldı, yeni potansiyel müşteriler aranıyor.');
        
        // NOTE: In a real scenario, this would trigger the LeadDiscoveryModal logic automatically.
        // For this context, we'll log a suggestion or trigger a specialized search if implemented.
        addThought('info', 'Otomatik keşif simülasyonu: 3 yeni aday bulundu (Mock).');
        return true;
    };

    const performOutreach = async (leads: Lead[]) => {
        // Simple mock for outreach - checking if we need to send initial mails
        // In reality, this connects to MailAutomation queue logic
        const pendingQueue = leads.filter(l => l.lead_durumu === 'aktif' && l.email && !l.son_kontakt_tarihi);
        if (pendingQueue.length > 0) {
            // Usually handled by MailAutomation, but agent can flag it
            addThought('info', `${pendingQueue.length} adet lead için mail gönderimi bekleniyor.`);
            return false; // Action not fully autonomous yet to prevent spam in demo
        }
        return false;
    };

    // --- MAIN LOOP ---

    const agentLoop = async () => {
        if (!isRunningRef.current) return;

        try {
            const leads = await api.leads.getAll();
            let actionTaken = false;

            // PRIORITY 1: Reply Drafting
            if (!actionTaken) actionTaken = await performAutoReplyDrafting(leads);

            // PRIORITY 2: Outreach (Business Hours Only)
            if (!actionTaken && isBusinessHours()) {
                // Check if we have leads ready for contact
                actionTaken = await performOutreach(leads);
            }

            // PRIORITY 3: Enrichment (High Score Leads)
            if (!actionTaken) actionTaken = await performAutoEnrichment(leads);

            // PRIORITY 4: Discovery (Refilling Pipeline)
            if (!actionTaken) actionTaken = await performSmartDiscovery(leads);

            if (actionTaken) {
                setAgentStatus('İşlem tamamlandı, dinleniyor...');
                // If action taken, run again sooner but not immediately
                loopTimeoutRef.current = setTimeout(agentLoop, 15000); 
            } else {
                setAgentStatus(isBusinessHours() ? 'Beklemede (İzleniyor)' : 'Mesai Dışı (Uyku Modu)');
                // If no action needed, sleep for full cycle
                loopTimeoutRef.current = setTimeout(agentLoop, CYCLE_INTERVAL);
            }

        } catch (error) {
            console.error("Agent Loop Error", error);
            addThought('error', 'Döngü hatası, sistem beklemeye alındı.');
            loopTimeoutRef.current = setTimeout(agentLoop, CYCLE_INTERVAL);
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
