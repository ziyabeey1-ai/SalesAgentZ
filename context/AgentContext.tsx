
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Lead, AgentThought, AgentConfig, Notification } from '../types';
import { api } from '../services/api';
import { learningService } from '../services/learningService';

interface AgentContextType {
    isAgentRunning: boolean;
    agentStatus: string;
    thoughts: AgentThought[];
    notifications: Notification[];
    pendingDraftsCount: number;
    agentConfig: AgentConfig;
    toggleAgent: () => void;
    dismissNotification: (id: string) => void;
    updateAgentConfig: (config: Partial<AgentConfig>) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [agentStatus, setAgentStatus] = useState('Beklemede');
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
    const [agentConfig, setAgentConfig] = useState<AgentConfig>({
        targetDistrict: 'Tümü',
        targetSector: 'Tümü',
        focusMode: 'balanced'
    });

    // Refs for loop management
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingRef = useRef(false);

    useEffect(() => {
        // Initial check
        checkPendingDrafts();
    }, []);

    const checkPendingDrafts = async () => {
        try {
            const leads = await api.leads.getAll();
            const count = leads.filter(l => l.draftResponse || l.lead_durumu === 'onay_bekliyor').length;
            setPendingDraftsCount(count);
        } catch (e) { console.error(e); }
    };

    const addThought = (type: AgentThought['type'], message: string) => {
        const thought: AgentThought = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type,
            message
        };
        setThoughts(prev => [...prev, thought].slice(-50)); // Keep last 50
    };

    const addNotification = (type: Notification['type'], title: string, message: string) => {
        // Mock notification logic
        console.log("Notification:", title, message);
    };

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const toggleAgent = () => {
        if (isAgentRunning) {
            stopAgent();
        } else {
            startAgent();
        }
    };

    const startAgent = () => {
        setIsAgentRunning(true);
        setAgentStatus('Başlatılıyor...');
        addThought('info', 'Ajan başlatıldı.');
        
        intervalRef.current = setInterval(agentLoop, 10000); // 10 seconds loop
    };

    const stopAgent = () => {
        setIsAgentRunning(false);
        setAgentStatus('Durduruldu');
        addThought('info', 'Ajan durduruldu.');
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const agentLoop = async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            setAgentStatus('Analiz yapılıyor...');
            
            // 1. Check for Replies (Sync) - Mocked for now as api doesn't implement it fully in stub
            // await api.gmail.syncReplies(leads); 

            // 2. Lead Discovery (Mock trigger)
            if (Math.random() > 0.7 && agentConfig.focusMode !== 'outreach_only') {
                setAgentStatus('Lead aranıyor...');
                addThought('action', 'Yeni lead fırsatları taranıyor...');
                // Logic to find leads would go here
            }

            // 3. Outreach (Mock trigger)
            if (Math.random() > 0.5 && agentConfig.focusMode !== 'discovery_only') {
                setAgentStatus('Mail gönderimi...');
                // performOutreach logic placeholder
            }

            checkPendingDrafts();
            setAgentStatus('Beklemede (Aktif)');

        } catch (error: any) {
            console.error("Agent Loop Error", error);
            addThought('error', `Döngü hatası: ${error.message}`);
        } finally {
            isProcessingRef.current = false;
        }
    };

    const updateAgentConfig = (config: Partial<AgentConfig>) => {
        setAgentConfig(prev => ({ ...prev, ...config }));
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
            updateAgentConfig
        }}>
            {children}
        </AgentContext.Provider>
    );
};

export const useAgent = () => {
    const context = useContext(AgentContext);
    if (!context) throw new Error("useAgent must be used within AgentProvider");
    return context;
};
