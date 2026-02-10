import React, { useState, useEffect } from 'react';
import { X, Activity, Target, TrendingUp, AlertTriangle, CheckCircle, BrainCircuit, Loader2, BarChart2 } from 'lucide-react';
import { Lead, LeadScoreDetails } from '../types';
import { api } from '../services/api';

interface SmartScoreModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onScoreUpdate: (lead: Lead) => void;
}

const SmartScoreModal: React.FC<SmartScoreModalProps> = ({ lead, isOpen, onClose, onScoreUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<LeadScoreDetails | undefined>(lead.scoreDetails);

  useEffect(() => {
    if (isOpen && lead) {
        if (!lead.scoreDetails) {
            handleCalculateScore();
        } else {
            setScoreDetails(lead.scoreDetails);
        }
    }
  }, [isOpen, lead]);

  const handleCalculateScore = async () => {
      setLoading(true);
      try {
          const details = await api.strategy.calculateLeadScore(lead);
          setScoreDetails(details);
      } catch (error) {
          console.error("Scoring failed", error);
      } finally {
          setLoading(false);
      }
  };

  const handleApplyScore = async () => {
      if (!scoreDetails) return;
      
      const updatedLead = { 
          ...lead, 
          lead_skoru: scoreDetails.finalLeadScore, 
          scoreDetails: scoreDetails,
          digitalWeakness: scoreDetails.digitalWeaknesses[0] // Set primary weakness for context
      };
      
      await api.leads.update(updatedLead);
      onScoreUpdate(updatedLead);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-700 text-white">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-950 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Dijital İhtiyaç Analizi</h3>
              <p className="text-xs text-slate-400">{lead.firma_adi} için AI Puanlaması</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Loader2 size={48} className="text-indigo-500 animate-spin" />
                    <p className="text-slate-400 text-sm animate-pulse">Web sitesi, SEO ve Sosyal Medya verileri taranıyor...</p>
                </div>
            ) : scoreDetails ? (
                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Big Score & Radar Substitute */}
                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-2xl p-6 text-center border border-slate-700 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30"></div>
                            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Genel İhtiyaç Skoru</h4>
                            
                            <div className="relative inline-block">
                                <svg className="w-40 h-40 transform -rotate-90">
                                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-700" />
                                    <circle cx="80" cy="80" r="70" stroke={scoreDetails.finalLeadScore >= 4 ? '#ef4444' : scoreDetails.finalLeadScore >= 3 ? '#f59e0b' : '#10b981'} strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * scoreDetails.totalScore / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-5xl font-black ${scoreDetails.finalLeadScore >= 4 ? 'text-red-500' : scoreDetails.finalLeadScore >= 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {scoreDetails.finalLeadScore}/5
                                    </span>
                                    <span className="text-xs text-slate-400 mt-1">{scoreDetails.totalScore} Puan</span>
                                </div>
                            </div>
                            
                            <p className="text-sm mt-4 font-medium text-slate-300">
                                {scoreDetails.finalLeadScore >= 4 ? "🚨 Acil Dijital Müdahale Gerekli" : scoreDetails.finalLeadScore === 3 ? "⚠️ İyileştirme Fırsatları Var" : "✅ Dijital Varlığı Güçlü"}
                            </p>
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Target size={14}/> Dönüşüm Olasılığı</h4>
                            <div className="text-2xl font-bold text-white mb-1">{scoreDetails.estimatedConversionProbability}</div>
                            <p className="text-xs text-slate-500 leading-relaxed">Sektörel aciliyet ve dijital eksiklikler baz alındığında satış yapma ihtimaliniz.</p>
                        </div>
                    </div>

                    {/* Middle Column: Category Breakdown */}
                    <div className="space-y-4 lg:col-span-2">
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                            <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart2 size={16} className="text-indigo-400"/> Kategori Analizi
                            </h4>
                            
                            <div className="space-y-4">
                                {Object.entries(scoreDetails.categoryScores).map(([key, score]) => (
                                    <div key={key} className="group">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <span className="text-indigo-300 font-bold">{score} Puan</span>
                                        </div>
                                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-125" 
                                                style={{ width: `${(Number(score) / 20) * 100}%` }} // Approximate scale normalization
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <AlertTriangle size={14}/> Kritik Zayıflıklar
                                </h4>
                                <ul className="space-y-2">
                                    {scoreDetails.digitalWeaknesses.map((weakness, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-red-200">
                                            <span className="mt-1.5 w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></span>
                                            {weakness}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-emerald-500/10 rounded-2xl p-5 border border-emerald-500/20">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <TrendingUp size={14}/> Satış Fırsatları
                                </h4>
                                <ul className="space-y-2">
                                    {scoreDetails.opportunityAreas.map((opp, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-emerald-200">
                                            <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></span>
                                            {opp}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30 flex gap-3 text-sm text-indigo-200">
                            <BrainCircuit size={20} className="flex-shrink-0 mt-0.5 text-indigo-400" />
                            <p className="leading-relaxed">"{scoreDetails.reasoning}"</p>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                    <p>Veri yüklenemedi.</p>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-700 flex justify-end gap-3">
            <button onClick={handleCalculateScore} disabled={loading} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
                Yeniden Analiz Et
            </button>
            <button onClick={handleApplyScore} disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all">
                <CheckCircle size={16} /> Skoru Kaydet & Uygula
            </button>
        </div>
      </div>
    </div>
  );
};

export default SmartScoreModal;