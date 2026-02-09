import React, { useEffect, useState } from 'react';
import { Lightbulb, TrendingUp, BarChart, ArrowRight } from 'lucide-react';
import { Lead, EmailTemplate } from '../types';
import { storage } from '../services/storage';

interface SmartAdvisorProps {
  lead: Lead;
}

interface Recommendation {
  action: string;
  reason: string;
  confidence: number; // 0-100
  templateId?: string;
  bestSector?: string;
}

const SmartAdvisor: React.FC<SmartAdvisorProps> = ({ lead }) => {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    analyzeLead(lead);
  }, [lead]);

  const analyzeLead = (currentLead: Lead) => {
    // 1. Get Learning Data
    const templates = storage.getTemplates();
    const sector = currentLead.sektor;

    // 2. Default Strategy: Contact
    let bestAction = "E-posta Gönder";
    let bestReason = "Genel başlangıç stratejisi.";
    let bestConfidence = 50;
    let selectedTemplateId = "";

    // 3. Reinforcement Learning Logic (Contextual Bandit)
    // Find best template for THIS sector
    let bestTemplate: EmailTemplate | null = null;
    let maxWinRate = 0;

    templates.filter(t => t.type === 'intro').forEach(t => {
        // Calculate Global Win Rate
        const globalRate = t.useCount > 0 ? t.successCount / t.useCount : 0;
        
        // Calculate Contextual Win Rate (Sector Specific)
        const sectorStats = t.sectorStats?.[sector];
        let sectorRate = 0;
        if (sectorStats && sectorStats.useCount > 0) {
            sectorRate = sectorStats.successCount / sectorStats.useCount;
        }

        // Weighted Score: Trust sector data more if we have samples (>5), otherwise blend with global
        // Alpha blending: alpha * sector + (1-alpha) * global
        const alpha = (sectorStats?.useCount || 0) > 5 ? 0.8 : 0.2;
        const finalScore = (sectorRate * alpha) + (globalRate * (1 - alpha));

        if (finalScore > maxWinRate) {
            maxWinRate = finalScore;
            bestTemplate = t;
        }
    });

    if (bestTemplate) {
        const ratePercent = Math.round(maxWinRate * 100);
        bestAction = `'${bestTemplate.name}' Şablonunu Kullan`;
        bestReason = `${sector} sektöründe %${ratePercent} başarı oranına sahip.`;
        bestConfidence = Math.min(99, 40 + (ratePercent / 2)); // Base 40 + half of success rate
        selectedTemplateId = bestTemplate.id;
    }

    // 4. Heuristics Adjustments (Rule-based overrides on top of RL)
    if (currentLead.lead_skoru >= 4) {
        bestConfidence += 10;
        bestReason += " Ayrıca lead skoru yüksek, hızlı dönüş ihtimali var.";
    }

    if (currentLead.lead_durumu === 'takipte') {
        bestAction = "Telefonla Ara";
        bestReason = "Mail etkileşimi oldu, şimdi insan sesi ile güven verme zamanı.";
        bestConfidence = 85;
    }

    setRecommendation({
        action: bestAction,
        reason: bestReason,
        confidence: bestConfidence,
        templateId: selectedTemplateId
    });
  };

  if (!recommendation) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Lightbulb size={24} className="text-yellow-300" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg mb-1">AI Tavsiyesi</h3>
                    <span className="flex items-center gap-1 text-xs font-medium bg-white/20 px-2 py-1 rounded-full">
                        <TrendingUp size={12} /> %{recommendation.confidence} Güven
                    </span>
                </div>
                <p className="text-white/90 text-sm font-medium mb-3">
                    {recommendation.action}
                </p>
                <div className="text-xs text-indigo-100 flex items-start gap-2 bg-black/20 p-2 rounded-lg">
                    <BarChart size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Neden? {recommendation.reason}</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SmartAdvisor;