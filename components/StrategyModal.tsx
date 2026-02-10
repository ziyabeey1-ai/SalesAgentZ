import React, { useState, useEffect } from 'react';
import { X, BrainCircuit, MessageSquare, Copy, Check, Target, Shield, Zap, Info, Loader2 } from 'lucide-react';
import { Lead, StrategyResult } from '../types';
import { api } from '../services/api';

interface StrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
}

const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, lead }) => {
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeTone, setActiveTone] = useState<'aggressive' | 'neutral' | 'consultative'>('neutral');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      fetchStrategy();
    }
  }, [isOpen, lead]);

  const fetchStrategy = async () => {
    setLoading(true);
    try {
      const result = await api.strategy.predictNextMove(lead);
      setStrategy(result);
      setActiveTone(result.recommendedTone);
    } catch (error) {
      console.error("Strategy prediction failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-900/50">
              <BrainCircuit size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Satranç Modu: Geleceği Gör</h3>
              <p className="text-xs text-slate-400">Olası hamleler ve stratejik yanıtlar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Satış simülasyonu çalıştırılıyor...</p>
              <p className="text-xs text-slate-400 mt-2">Gemini 3 Pro, müşteri psikolojisini analiz ediyor.</p>
            </div>
          ) : strategy ? (
            <>
              {/* Sidebar: Questions List */}
              <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 overflow-y-auto">
                <div className="p-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 text-xs text-indigo-800 flex gap-2">
                    <Info size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1">AI Analizi:</span>
                      {strategy.reasoning}
                    </div>
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Tahmini Sorular</h4>
                  
                  <div className="space-y-2">
                    {strategy.possibleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setActiveQuestionIndex(idx); setActiveTone(strategy.recommendedTone); }}
                        className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                          activeQuestionIndex === idx 
                            ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500 z-10' 
                            : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            q.category === 'pricing' ? 'bg-green-100 text-green-700' :
                            q.category === 'timeline' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {q.category}
                          </span>
                          {activeQuestionIndex === idx && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>}
                        </div>
                        <p className={`text-sm font-medium leading-snug ${activeQuestionIndex === idx ? 'text-slate-900' : ''}`}>
                          "{q.question}"
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Content: Response Drafts */}
              <div className="flex-1 bg-white p-6 md:p-8 flex flex-col overflow-y-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    "{strategy.possibleQuestions[activeQuestionIndex].question}"
                  </h2>
                  <p className="text-slate-500 text-sm">Bu soru gelirse, işte en iyi 3 yanıt stratejisi:</p>
                </div>

                {/* Tone Tabs */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                  <button 
                    onClick={() => setActiveTone('aggressive')}
                    className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTone === 'aggressive' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Zap size={16} /> Agresif (Satış)
                  </button>
                  <button 
                    onClick={() => setActiveTone('neutral')}
                    className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTone === 'neutral' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Shield size={16} /> Dengeli
                  </button>
                  <button 
                    onClick={() => setActiveTone('consultative')}
                    className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTone === 'consultative' ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Target size={16} /> Danışman
                  </button>
                </div>

                {/* Response Display */}
                <div className={`flex-1 rounded-2xl border-2 p-6 relative transition-all ${
                  activeTone === 'aggressive' ? 'border-red-100 bg-red-50/30' :
                  activeTone === 'neutral' ? 'border-blue-100 bg-blue-50/30' :
                  'border-green-100 bg-green-50/30'
                }`}>
                  <div className="absolute top-4 right-4">
                    {activeTone === strategy.recommendedTone && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-indigo-600 text-white px-2 py-1 rounded shadow-sm mb-2 ml-auto w-fit">
                        <BrainCircuit size={12} /> Önerilen
                      </span>
                    )}
                  </div>

                  <h5 className={`text-xs font-bold uppercase tracking-wider mb-4 ${
                    activeTone === 'aggressive' ? 'text-red-600' :
                    activeTone === 'neutral' ? 'text-blue-600' :
                    'text-green-600'
                  }`}>
                    {activeTone === 'aggressive' ? 'Hızlı Sonuç Odaklı Yaklaşım' :
                     activeTone === 'neutral' ? 'Profesyonel Bilgilendirme' :
                     'Değer ve İlişki Odaklı Yaklaşım'}
                  </h5>

                  <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap font-medium">
                    {strategy.possibleQuestions[activeQuestionIndex].responses[activeTone]}
                  </p>
                </div>

                {/* Footer Action */}
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => handleCopy(strategy.possibleQuestions[activeQuestionIndex].responses[activeTone])}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                      copied ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Kopyalandı!' : 'Yanıtı Kopyala'}
                  </button>
                </div>

              </div>
            </>
          ) : (
            <div className="p-8 text-center w-full">Bir hata oluştu. Lütfen tekrar deneyin.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyModal;