
import { Lead, Task, ActionLog, Interaction, DashboardStats, UsageStats, EmailTemplate, TemplateStats, UserProfile, CalendarEvent, RegionStat } from '../types';
import { MOCK_LEADS, MOCK_TASKS, MOCK_LOGS, MOCK_INTERACTIONS, MOCK_TEMPLATES } from './mockService';

const KEYS = {
  LEADS: 'sales_agent_leads',
  TASKS: 'sales_agent_tasks',
  LOGS: 'sales_agent_logs',
  INTERACTIONS: 'sales_agent_interactions',
  USAGE: 'sales_agent_usage',
  TEMPLATES: 'sales_agent_templates',
  PROFILE: 'sales_agent_profile',
  EVENTS: 'sales_agent_events'
};

// Pricing Constants (Gemini Flash Approx)
const COST_PER_REQUEST = 0.0004; 

export const storage = {
  init: () => {
    if (!localStorage.getItem(KEYS.PROFILE)) {
        localStorage.setItem(KEYS.PROFILE, JSON.stringify({ isSetupComplete: false }));
    }
  },

  loadMocks: () => {
      localStorage.setItem(KEYS.LEADS, JSON.stringify(MOCK_LEADS));
      localStorage.setItem(KEYS.TASKS, JSON.stringify(MOCK_TASKS));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(MOCK_LOGS));
      localStorage.setItem(KEYS.INTERACTIONS, JSON.stringify(MOCK_INTERACTIONS));
      
      const templatesWithStats = MOCK_TEMPLATES.map(t => ({
          ...t, 
          useCount: 0, 
          successCount: 0,
          sectorStats: {} 
      }));
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templatesWithStats));
  },

  // CRITICAL: Missing method added
  clearAllData: () => {
      localStorage.removeItem(KEYS.LEADS);
      localStorage.removeItem(KEYS.TASKS);
      localStorage.removeItem(KEYS.LOGS);
      localStorage.removeItem(KEYS.INTERACTIONS);
      localStorage.removeItem(KEYS.TEMPLATES);
      localStorage.removeItem(KEYS.EVENTS);
      // We do NOT clear PROFILE or USAGE here to allow reconfiguration without losing identity/credits immediately
  },

  // LEADS
  getLeads: (): Lead[] => {
    const data = localStorage.getItem(KEYS.LEADS);
    return data ? JSON.parse(data) : [];
  },
  
  saveLead: (lead: Lead) => {
    const leads = storage.getLeads();
    const newLeads = [lead, ...leads];
    localStorage.setItem(KEYS.LEADS, JSON.stringify(newLeads));
  },

  updateLead: (updatedLead: Lead) => {
    const leads = storage.getLeads();
    
    // Check for "Learning Event": If status changes to 'olumlu' or 'teklif_gonderildi'
    const oldLead = leads.find(l => l.id === updatedLead.id);
    if (oldLead && updatedLead.lastUsedTemplateId && 
       (updatedLead.lead_durumu === 'olumlu' || updatedLead.lead_durumu === 'teklif_gonderildi') && 
       oldLead.lead_durumu !== updatedLead.lead_durumu) {
        
        storage.recordTemplateSuccess(updatedLead.lastUsedTemplateId, updatedLead.sektor);
    }

    const newLeads = leads.map(l => l.id === updatedLead.id ? updatedLead : l);
    localStorage.setItem(KEYS.LEADS, JSON.stringify(newLeads));
  },

  // TASKS
  getTasks: (): Task[] => {
    const data = localStorage.getItem(KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  },

  saveTask: (task: Task) => {
    const tasks = storage.getTasks();
    const newTasks = [task, ...tasks];
    localStorage.setItem(KEYS.TASKS, JSON.stringify(newTasks));
  },

  updateTask: (updatedTask: Task) => {
    const tasks = storage.getTasks();
    const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    localStorage.setItem(KEYS.TASKS, JSON.stringify(newTasks));
  },

  // LOGS
  getLogs: (): ActionLog[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },

  addLog: (log: ActionLog) => {
    const logs = storage.getLogs();
    const newLogs = [log, ...logs].slice(0, 50);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(newLogs));
  },

  // INTERACTIONS
  getInteractions: (): Interaction[] => {
    const data = localStorage.getItem(KEYS.INTERACTIONS);
    return data ? JSON.parse(data) : [];
  },

  addInteraction: (interaction: Interaction) => {
    const interactions = storage.getInteractions();
    const newInteractions = [interaction, ...interactions];
    localStorage.setItem(KEYS.INTERACTIONS, JSON.stringify(newInteractions));
  },

  // TEMPLATES
  getTemplates: (): EmailTemplate[] => {
      const data = localStorage.getItem(KEYS.TEMPLATES);
      return data ? JSON.parse(data) : [];
  },

  saveTemplate: (template: EmailTemplate) => {
      const templates = storage.getTemplates();
      let newTemplates = templates;
      if (template.isActive) {
          newTemplates = templates.map(t => t.type === template.type ? { ...t, isActive: false } : t);
      }
      const tplWithStats: EmailTemplate = { 
          ...template, 
          useCount: 0, 
          successCount: 0,
          sectorStats: {} 
      };
      newTemplates.push(tplWithStats);
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(newTemplates));
  },

  updateTemplate: (template: EmailTemplate) => {
      const templates = storage.getTemplates();
      let newTemplates = templates;
      if (template.isActive) {
          newTemplates = templates.map(t => (t.type === template.type && t.id !== template.id) ? { ...t, isActive: false } : t);
      }
      newTemplates = newTemplates.map(t => t.id === template.id ? template : t);
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(newTemplates));
  },

  deleteTemplate: (id: string) => {
      const templates = storage.getTemplates();
      const newTemplates = templates.filter(t => t.id !== id);
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(newTemplates));
  },

  incrementTemplateUsage: (id: string, sector: string = 'Diğer') => {
      const templates = storage.getTemplates();
      const newTemplates = templates.map(t => {
          if (t.id === id) {
              const currentSectorStats = t.sectorStats || {};
              const secStat = currentSectorStats[sector] || { useCount: 0, successCount: 0 };
              
              return { 
                  ...t, 
                  useCount: (t.useCount || 0) + 1,
                  sectorStats: {
                      ...currentSectorStats,
                      [sector]: { ...secStat, useCount: secStat.useCount + 1 }
                  }
              };
          }
          return t;
      });
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(newTemplates));
  },

  recordTemplateSuccess: (id: string, sector: string = 'Diğer') => {
      const templates = storage.getTemplates();
      const newTemplates = templates.map(t => {
          if (t.id === id) {
              const currentSectorStats = t.sectorStats || {};
              const secStat = currentSectorStats[sector] || { useCount: 0, successCount: 0 };

              return { 
                  ...t, 
                  successCount: (t.successCount || 0) + 1,
                  sectorStats: {
                      ...currentSectorStats,
                      [sector]: { ...secStat, successCount: secStat.successCount + 1 }
                  }
              };
          }
          return t;
      });
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(newTemplates));
  },

  // PROFILE
  getUserProfile: (): UserProfile => {
      const data = localStorage.getItem(KEYS.PROFILE);
      if (data) {
          const profile = JSON.parse(data);
          if (typeof profile.isSetupComplete === 'undefined') profile.isSetupComplete = false;
          return profile;
      }
      return {
          fullName: '',
          companyName: '',
          role: '',
          website: '',
          phone: '',
          email: '',
          tone: 'Profesyonel',
          isSetupComplete: false
      };
  },

  saveUserProfile: (profile: UserProfile) => {
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  },

  // EVENTS (CRITICAL MISSING METHODS)
  getCalendarEvents: (): CalendarEvent[] => {
      const data = localStorage.getItem(KEYS.EVENTS);
      return data ? JSON.parse(data) : [];
  },

  saveCalendarEvent: (event: CalendarEvent) => {
      const events = storage.getCalendarEvents();
      const newEvents = [...events, event];
      localStorage.setItem(KEYS.EVENTS, JSON.stringify(newEvents));
  },

  // STATS
  calculateStats: (): DashboardStats => {
    const leads = storage.getLeads();
    const usage = storage.getUsage();
    
    const totalLeads = leads.length;
    const contacted = leads.filter(l => ['takipte', 'teklif_gonderildi', 'olumlu', 'olumsuz'].includes(l.lead_durumu)).length;
    const responses = leads.filter(l => ['olumlu', 'olumsuz', 'teklif_gonderildi'].includes(l.lead_durumu)).length;
    const hotLeads = leads.filter(l => l.lead_skoru >= 4 && l.lead_durumu !== 'olumlu').length;
    const scanned = Math.floor(totalLeads * 1.5) + 20;

    const districtMap: Record<string, {total: number, converted: number}> = {};
    leads.forEach(l => {
        const dist = l.ilce || 'Diğer';
        if (!districtMap[dist]) districtMap[dist] = { total: 0, converted: 0 };
        
        districtMap[dist].total++;
        if (['teklif_gonderildi', 'olumlu'].includes(l.lead_durumu)) {
            districtMap[dist].converted++;
        }
    });

    const districtBreakdown: RegionStat[] = Object.keys(districtMap).map(key => ({
        name: key,
        totalLeads: districtMap[key].total,
        converted: districtMap[key].converted,
        conversionRate: districtMap[key].total > 0 ? (districtMap[key].converted / districtMap[key].total) * 100 : 0
    })).sort((a,b) => b.totalLeads - a.totalLeads);

    return {
      taranan_firma: scanned,
      lead_sayisi: totalLeads,
      mail_gonderildi: contacted,
      geri_donus: responses,
      sicak_leadler: hotLeads,
      hedef_orani: Math.min(100, Math.round((totalLeads / 100) * 100)),
      toplam_maliyet: usage.estimatedCost,
      districtBreakdown: districtBreakdown
    };
  },

  // USAGE
  getUsage: (): UsageStats => {
      const today = new Date().toISOString().slice(0, 10);
      const data = localStorage.getItem(KEYS.USAGE);
      
      if (data) {
          const parsed = JSON.parse(data);
          if (parsed.date === today) return parsed;
      }

      const defaults = { date: today, aiCalls: 0, searchCalls: 0, dailyLimit: 50, estimatedCost: 0 };
      localStorage.setItem(KEYS.USAGE, JSON.stringify(defaults));
      return defaults;
  },

  incrementUsage: (type: 'ai' | 'search') => {
      const stats = storage.getUsage();
      if (type === 'ai') {
          stats.aiCalls++;
          stats.estimatedCost += COST_PER_REQUEST;
      }
      if (type === 'search') stats.searchCalls++;
      localStorage.setItem(KEYS.USAGE, JSON.stringify(stats));
      return stats;
  },

  updateLimit: (newLimit: number) => {
      const stats = storage.getUsage();
      stats.dailyLimit = newLimit;
      localStorage.setItem(KEYS.USAGE, JSON.stringify(stats));
  }
};

storage.init();
