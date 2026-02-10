
import { Lead } from '../types';
import { storage } from './storage';

interface LearningWeights {
    sectorWeights: Record<string, number>;
    districtWeights: Record<string, number>;
    weaknessWeights: Record<string, number>; // e.g. "Site Yok" vs "Kötü Site"
    lastUpdated: string;
}

interface LearningInsight {
    id: string;
    type: 'positive' | 'negative' | 'trend';
    message: string;
    impact: string; // e.g. "Skorlama +%15"
    timestamp: string;
}

const STORAGE_KEY_WEIGHTS = 'sales_agent_weights';
const STORAGE_KEY_INSIGHTS = 'sales_agent_insights';

const INITIAL_WEIGHTS: LearningWeights = {
    sectorWeights: {
        'Sağlık': 1.2, // High value default
        'Restoran': 1.0,
        'Emlak': 1.1,
        'Güzellik': 1.0,
        'Diğer': 1.0
    },
    districtWeights: {
        'Kadıköy': 1.1, // High traffic default
        'Beşiktaş': 1.1
    },
    weaknessWeights: {
        'Web Sitesi Yok': 1.5, // Critical pain point
        'Mobil Uyumsuz': 1.2,
        'Eski Tasarım': 1.1
    },
    lastUpdated: new Date().toISOString()
};

export const learningService = {
    getWeights: (): LearningWeights => {
        const data = localStorage.getItem(STORAGE_KEY_WEIGHTS);
        return data ? JSON.parse(data) : INITIAL_WEIGHTS;
    },

    getInsights: (): LearningInsight[] => {
        const data = localStorage.getItem(STORAGE_KEY_INSIGHTS);
        return data ? JSON.parse(data) : [];
    },

    // Called when a lead status changes to 'olumlu' (Won) or 'olumsuz' (Lost)
    learnFromOutcome: async (lead: Lead, outcome: 'won' | 'lost') => {
        const weights = learningService.getWeights();
        const insights = learningService.getInsights();
        const multiplier = outcome === 'won' ? 0.1 : -0.05; // Increase 10% on win, decrease 5% on loss

        // 1. Sector Learning
        const currentSectorWeight = weights.sectorWeights[lead.sektor] || 1.0;
        const newSectorWeight = Math.max(0.5, Math.min(2.0, currentSectorWeight + multiplier));
        weights.sectorWeights[lead.sektor] = Number(newSectorWeight.toFixed(2));

        // 2. District Learning
        const currentDistrictWeight = weights.districtWeights[lead.ilce] || 1.0;
        const newDistrictWeight = Math.max(0.5, Math.min(2.0, currentDistrictWeight + multiplier));
        weights.districtWeights[lead.ilce] = Number(newDistrictWeight.toFixed(2));

        // 3. Generate Insight Log
        if (Math.abs(newSectorWeight - currentSectorWeight) > 0.01) {
            const trend = outcome === 'won' ? 'yükselişte' : 'düşüşte';
            const impact = outcome === 'won' ? `Skor +%${(multiplier * 100).toFixed(0)}` : `Skor %${(multiplier * 100).toFixed(0)}`;
            
            const newInsight: LearningInsight = {
                id: Math.random().toString(36).substr(2, 9),
                type: outcome === 'won' ? 'positive' : 'negative',
                message: `"${lead.sektor}" sektörü ${trend}. Ağırlık güncellendi.`,
                impact: impact,
                timestamp: new Date().toISOString()
            };
            insights.unshift(newInsight);
        }

        // Save
        weights.lastUpdated = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(weights));
        localStorage.setItem(STORAGE_KEY_INSIGHTS, JSON.stringify(insights.slice(0, 20))); // Keep last 20
        
        console.log(`[AI Learning] Updated weights for ${lead.sektor}: ${currentSectorWeight} -> ${newSectorWeight}`);
    },

    // Called by Score Calculator
    applyWeights: (baseScore: number, lead: Lead): number => {
        const weights = learningService.getWeights();
        
        let multiplier = 1.0;
        
        // Sector Multiplier
        if (weights.sectorWeights[lead.sektor]) {
            multiplier *= weights.sectorWeights[lead.sektor];
        }
        
        // District Multiplier
        if (weights.districtWeights[lead.ilce]) {
            multiplier *= weights.districtWeights[lead.ilce];
        }

        // Weakness Multiplier (Simplified logic for now)
        if (lead.websitesi_var_mi === 'Hayır') {
            multiplier *= (weights.weaknessWeights['Web Sitesi Yok'] || 1.2);
        }

        // Apply and Clamp (1-5 range is usually for UI, but internal score can be higher)
        // Here we return a raw score that can be mapped to 1-5 later if needed, 
        // but since the app expects 1-5, we'll try to keep it proportional but boosted.
        
        let finalScore = baseScore * multiplier;
        
        // Cap at 5 for UI consistency, but maybe allow internal overrides in future
        return Math.min(5, Math.max(1, Math.round(finalScore)));
    }
};
