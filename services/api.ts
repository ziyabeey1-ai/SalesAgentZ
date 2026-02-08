import { Lead, DashboardStats, Task, Interaction, ActionLog } from '../types';
import { MOCK_LEADS, getStats, MOCK_TASKS, MOCK_LOGS, MOCK_INTERACTIONS } from './mockService';

// Simulator utility to mimic network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  leads: {
    getAll: async (): Promise<Lead[]> => {
      await delay(800); // Simulate network delay
      return [...MOCK_LEADS];
    },
    create: async (lead: Lead): Promise<Lead> => {
      await delay(500);
      return lead;
    },
    logInteraction: async (leadId: string, type: 'email' | 'whatsapp'): Promise<void> => {
        await delay(300);
        console.log(`Interaction logged for lead ${leadId} via ${type}`);
    }
  },
  
  dashboard: {
    getStats: async (): Promise<DashboardStats> => {
      await delay(600);
      return getStats();
    },
    getLogs: async (): Promise<ActionLog[]> => {
      await delay(500);
      return [...MOCK_LOGS];
    }
  },

  tasks: {
    getAll: async (): Promise<Task[]> => {
      await delay(700);
      return [...MOCK_TASKS];
    }
  },

  reports: {
    getPerformanceData: async () => {
        await delay(1000);
        return {
            funnel: [
                { name: 'Taranan', value: 1200, fill: '#94a3b8' },
                { name: 'Lead', value: 450, fill: '#6366f1' },
                { name: 'Temas', value: 380, fill: '#8b5cf6' },
                { name: 'Yanıt', value: 85, fill: '#ec4899' },
                { name: 'Teklif', value: 40, fill: '#f59e0b' },
                { name: 'Satış', value: 12, fill: '#10b981' },
            ],
            weeklyTrend: [
                { name: 'Pzt', sent: 45, response: 5 },
                { name: 'Sal', sent: 52, response: 8 },
                { name: 'Çar', sent: 48, response: 12 },
                { name: 'Per', sent: 60, response: 15 },
                { name: 'Cum', sent: 55, response: 10 },
                { name: 'Cmt', sent: 20, response: 3 },
                { name: 'Paz', sent: 15, response: 2 },
            ],
            sectorSuccessRate: [
                { subject: 'Sağlık', A: 120, B: 110, fullMark: 150 },
                { subject: 'Emlak', A: 98, B: 130, fullMark: 150 },
                { subject: 'Restoran', A: 86, B: 130, fullMark: 150 },
                { subject: 'Güzellik', A: 99, B: 100, fullMark: 150 },
                { subject: 'Diğer', A: 85, B: 90, fullMark: 150 },
            ]
        };
    }
  }
};
