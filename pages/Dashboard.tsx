
import React, { useEffect, useState, useRef } from 'react';
import { 
  Building2, 
  Mail, 
  MessageCircle, 
  Flame,
  ArrowUpRight,
  MoreHorizontal,
  Loader2,
  Send,
  Headphones,
  Volume2,
  DollarSign,
  BrainCircuit,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  LayoutDashboard,
  MapPin,
  Terminal,
  Activity,
  PauseCircle,
  PlayCircle,
  Target,
  BarChart,
  Users,
  Search,
  Sparkles,
  Zap,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { api } from '../services/api';
import { learningService } from '../services/learningService';
import { DashboardStats, ActionLog, Lead, MarketStrategyResult, Interaction } from '../types';
import EmptyState from '../components/EmptyState';
import { useAgent } from '../context/AgentContext';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  
  const { thoughts, isAgentRunning, toggleAgent, agentConfig } = useAgent();
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const [briefingStatus, setBriefingStatus] = useState<'idle' | 'loading' | 'playing'>('idle');

  // Strategy State
  const [strategyResult, setStrategyResult] = useState<MarketStrategyResult | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  
  // Learning Insights State
  const [aiInsights, setAiInsights] = useState<any[]>([]);

  const normalizeStrategyResult = (raw: any): MarketStrategyResult => {
    return {
      marketAnalysis: {
        sectorDigitalMaturity: Number(raw?.marketAnalysis?.sectorDigitalMaturity ?? 5),
        regionEconomicActivity: Number(raw?.marketAnalysis?.regionEconomicActivity ?? 5),
        seasonalFactor: raw?.marketAnalysis?.seasonalFactor || 'Bilinmiyor',
        overallOpportunity: raw?.marketAnalysis?.overallOpportunity || 'Orta'
      },
      idealLeadProfile: {
        companyAge: raw?.idealLeadProfile?.companyAge || '-',
        employeeCount: raw?.idealLeadProfile?.employeeCount || '-',
        estimatedRevenue: raw?.idealLeadProfile?.estimatedRevenue || '-',
        digitalMaturity: Number(raw?.idealLeadProfile?.digitalMaturity ?? 3),
        hasWebsite: Boolean(raw?.idealLeadProfile?.hasWebsite),
        reasoning: raw?.idealLeadProfile?.reasoning || 'Yeterli veri yok.'
      },
      strategyPriority: Array.isArray(raw?.strategyPriority)
        ? raw.strategyPriority.map((item: any, idx: number) => ({
            name: item?.name || `Öneri ${idx + 1}`,
            priority: Number(item?.priority ?? idx + 1),
            reasoning: item?.reasoning || 'Açıklama yok.',
            searchTerms: Array.isArray(item?.searchTerms) ? item.searchTerms : []
          }))
        : [],
      regionRotation: Array.isArray(raw?.regionRotation) ? raw.regionRotation : [],
      actionPlan: {
        nextCycle: raw?.actionPlan?.nextCycle || '-',
        expectedLeadQuality: raw?.actionPlan?.expectedLeadQuality || 'Orta',
        estimatedConversion: raw?.actionPlan?.estimatedConversion || '-'
      },
      lastUpdated: raw?.lastUpdated || new Date().toISOString()
    };
  };

  useEffect(() => {
    const syncGeminiConfig = () => {
      const key = (localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey') || '').trim();
      setIsGeminiConfigured(!!key);
    };

    syncGeminiConfig();
    window.addEventListener('storage', syncGeminiConfig);
    return () => window.removeEventListener('storage', syncGeminiConfig);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
        try {
            const [statsData, leadsData, reportData, interactionsData] = await Promise.all([
                api.dashboard.getStats(),
                api.leads.getAll(),
                api.reports.getPerformanceData(),
                api.interactions.getRecent(10)
            ]);
            setStats(statsData);
            setLeads(leadsData);
            setRecentInteractions(interactionsData);
            
            const mappedChartData = reportData.weeklyTrend.map((item: any) => ({
                name: item.name,
                sent: item.sent,
                response: item.response
            }));
            setChartData(mappedChartData);
            setAiInsights(learningService.getInsights()); // Fetch insights
            
            // Initial strategy load if we have data
            if (leadsData.length > 0) {
                loadStrategy();
            }
        } catch (e) {
            console.error("Dashboard data load error", e);
        } finally {
            setLoading(false);
        }
    };
    fetchDashboardData();
  }, []);

  // FIX: Scroll container to top (newest items) instead of scrolling window to bottom element
  useEffect(() => {
      if (terminalRef.current) {
          terminalRef.current.scrollTo({
              top: 0,
              behavior: 'smooth'
          });
      }
  }, [thoughts]);

  const loadStrategy = async () => {
      setLoadingStrategy(true);
      try {
          // Use Agent Config for target
          const result = await api.strategy.analyzeMarket(agentConfig.targetSector, agentConfig.targetDistrict);
          setStrategyResult(normalizeStrategyResult(result));
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingStrategy(false);
      }
  };

  const handleSendReport = async () => {
      if (!stats) return;
      setSendingReport(true);
      try {
          const hotLeads = leads.filter(l => l.lead_skoru >= 4 && l.lead_durumu !== 'olumlu').slice(0, 5);
          const result = await api.whatsapp.sendReport(stats, hotLeads);
          
          if (result.status === 'cancelled') return;

          const isWebMode = result.status === 'fallback_web';
          
          await api.dashboard.logAction(
              'WhatsApp Raporu', 
              isWebMode ? 'WhatsApp Web açıldı (Manuel)' : 'API ile iletildi', 
              'success'
          );
          
          if (isWebMode) {
              alert("WhatsApp Web açıldı. Lütfen açılan pencereden 'Gönder' butonuna basın.");
          } else {
              alert("Rapor API üzerinden gönderildi!");
          }
      } catch (error) {
          console.error(error);
          alert("Gönderim başarısız.");
      } finally {
          setSendingReport(false);
      }
  };

  const handlePlayBriefing = async () => {
      setBriefingStatus('loading');
      try {
          await api.briefing.generateAndPlay();
          setBriefingStatus('playing');
          setTimeout(() => setBriefingStatus('idle'), 15000); 
      } catch (error) {
          console.error(error);
          alert("Brifing oluşturulamadı.");
          setBriefingStatus('idle');
      }
  };

  // Helper to find lead name by id
  const getLeadName = (id: string) => {
      const l = leads.find(lead => lead.id === id);
      return l ? l.firma_adi : 'Bilinmeyen Firma';
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full min-h-[500px]">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
      );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-end mb-4 gap-3">
          <button 
            onClick={handlePlayBriefing}
            disabled={briefingStatus !== 'idle'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
                briefingStatus === 'playing' ? 'bg-rose-100 text-rose-700 animate-pulse border border-rose-200' :
                'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
              {briefingStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : 
               briefingStatus === 'playing' ? <Volume2 size={16} /> : <Headphones size={16} />}
              {briefingStatus === 'loading' ? 'Hazırlanıyor...' : 
               briefingStatus === 'playing' ? 'Çalıyor...' : 'Günlük Brifingi Dinle'}
          </button>

          <button 
            onClick={handleSendReport}
            disabled={sendingReport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
              {sendingReport ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              {sendingReport ? 'Hazırlanıyor...' : 'WhatsApp Raporu Gönder'}
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Building2 size={24} />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-100">
              <ArrowUpRight size={14} /> %85
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Taranan Firma</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{stats.taranan_firma}<span className="text-slate-400 text-sm font-normal ml-1">/100</span></p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${stats.hedef_orani}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Mail size={24} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Mail Gönderildi</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{stats.mail_gonderildi}</p>
          </div>
          <p className="text-sm text-slate-400 mt-4">Bugün {stats.lead_sayisi} lead bulundu</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group hover:border-orange-200 transition-colors cursor-pointer">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100 rounded-full -mr-8 -mt-8 opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
              <Flame size={24} />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-slate-500 text-sm font-medium">Sıcak Lead</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{stats.sicak_leadler}</p>
          </div>
          <p className="text-sm text-orange-600 mt-4 font-bold relative z-10 flex items-center gap-1">Hemen aksiyon al <ArrowUpRight size={14}/></p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-green-50 rounded-xl text-green-600">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-slate-500 text-sm font-medium">Tahmini Maliyet</h3>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">${stats.toplam_maliyet.toFixed(4)}</p>
          </div>
          <p className="text-sm text-green-600 mt-4 font-medium">Verimli kullanım</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Terminal & Insights */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Live Terminal */}
            <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-800 h-[350px]">
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isAgentRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                            <Terminal size={14} className="text-indigo-400" />
                            CANLI OTOPİLOT TERMİNALİ
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                            GEMINI-3-FLASH // {isGeminiConfigured ? 'READY' : 'OFFLINE'}
                        </span>
                        <button 
                            onClick={toggleAgent}
                            className={`p-1.5 rounded-full ${isAgentRunning ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'} transition-colors`}
                            title={isAgentRunning ? "Durdur" : "Başlat"}
                        >
                            {isAgentRunning ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        </button>
                    </div>
                </div>
                
                <div 
                    ref={terminalRef} 
                    className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3 bg-slate-900/50 relative"
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                    
                    {thoughts.length === 0 ? (
                        <div className="text-slate-600 italic text-center mt-20">
                            Sistem hazır. Başlatmak için play butonuna basın.
                        </div>
                    ) : (
                        thoughts.slice().reverse().map((thought) => (
                            <div key={thought.id} className="flex gap-3 animate-slide-in-right group">
                                <span className="text-slate-500 flex-shrink-0 w-16">{thought.timestamp}</span>
                                <div className="flex-1 flex gap-2">
                                    <span className={`font-bold flex-shrink-0 uppercase w-20 ${
                                        thought.type === 'decision' ? 'text-purple-400' :
                                        thought.type === 'action' ? 'text-indigo-400' :
                                        thought.type === 'success' ? 'text-green-400' :
                                        thought.type === 'error' ? 'text-red-400' :
                                        thought.type === 'wait' ? 'text-amber-400' :
                                        thought.type === 'warning' ? 'text-orange-400' :
                                        'text-blue-400'
                                    }`}>
                                        [{thought.type}]
                                    </span>
                                    <span className="text-slate-300 group-hover:text-white transition-colors">
                                        {thought.message}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* AI Learning Insights */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl border border-indigo-800 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Sparkles size={18} className="text-yellow-300" /> Yapay Zeka Öğrenimi
                    </h3>
                    <span className="text-[10px] bg-white/10 px-2 py-1 rounded border border-white/10">Otomatik Optimizasyon</span>
                </div>
                
                {aiInsights.length > 0 ? (
                    <div className="space-y-3 relative z-10">
                        {aiInsights.slice(0, 3).map((insight, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                <div className={`p-2 rounded-full ${insight.type === 'positive' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {insight.type === 'positive' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white/90">{insight.message}</p>
                                    <p className="text-[10px] text-white/60">{new Date(insight.timestamp).toLocaleTimeString()} • Etki: {insight.impact}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-indigo-200 text-sm relative z-10">
                        <BrainCircuit size={32} className="mx-auto mb-2 opacity-50" />
                        <p>Henüz yeterli veri yok. Satış yaptıkça yapay zeka stratejiyi güncelleyecek.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Strategy War Room */}
        <div className="relative rounded-2xl shadow-xl overflow-hidden group h-full flex flex-col bg-slate-900 border border-slate-800">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 border-b border-indigo-500/30 flex justify-between items-center relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-white">
                    <BrainCircuit className="text-indigo-400" size={20} />
                    Savaş Odası
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                        {agentConfig.targetDistrict} / {agentConfig.targetSector}
                    </span>
                    <button 
                      onClick={loadStrategy} 
                      disabled={loadingStrategy}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white"
                    >
                        {loadingStrategy ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14} />}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 custom-scrollbar">
                {strategyResult ? (
                    <>
                        {/* Market Scores */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                <div className="text-xs text-slate-400 mb-1">Dijital Olgunluk</div>
                                <div className="text-xl font-bold text-indigo-400">{strategyResult.marketAnalysis.sectorDigitalMaturity}/10</div>
                                <div className="w-full bg-slate-700 h-1 mt-2 rounded-full overflow-hidden">
                                    <div className="bg-indigo-500 h-full" style={{width: `${strategyResult.marketAnalysis.sectorDigitalMaturity * 10}%`}}></div>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                <div className="text-xs text-slate-400 mb-1">Ekon. Aktivite</div>
                                <div className="text-xl font-bold text-green-400">{strategyResult.marketAnalysis.regionEconomicActivity}/10</div>
                                <div className="w-full bg-slate-700 h-1 mt-2 rounded-full overflow-hidden">
                                    <div className="bg-green-500 h-full" style={{width: `${strategyResult.marketAnalysis.regionEconomicActivity * 10}%`}}></div>
                                </div>
                            </div>
                        </div>

                        {/* Top Strategy */}
                        {strategyResult.strategyPriority[0] && (
                            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 p-4 rounded-xl border border-indigo-500/30">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Target size={14} className="text-indigo-400"/>
                                        {strategyResult.strategyPriority[0].name}
                                    </h4>
                                    <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-bold">#{strategyResult.strategyPriority[0].priority}</span>
                                </div>
                                <p className="text-xs text-indigo-200 mb-3 leading-relaxed">
                                    {strategyResult.strategyPriority[0].reasoning}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {strategyResult.strategyPriority[0].searchTerms.map((term, idx) => (
                                        <span key={idx} className="text-[9px] bg-black/30 text-slate-300 px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                                            <Search size={8}/> {term}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ICP Card */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                                <Users size={12} className="text-orange-400"/> İdeal Müşteri Profili (ICP)
                            </h4>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                <div className="text-slate-500">Yaş: <span className="text-slate-300">{strategyResult.idealLeadProfile.companyAge}</span></div>
                                <div className="text-slate-500">Çalışan: <span className="text-slate-300">{strategyResult.idealLeadProfile.employeeCount}</span></div>
                                <div className="text-slate-500">Ciro: <span className="text-slate-300">{strategyResult.idealLeadProfile.estimatedRevenue}</span></div>
                                <div className="text-slate-500">Site: <span className={`font-bold ${strategyResult.idealLeadProfile.hasWebsite ? 'text-green-400' : 'text-red-400'}`}>{strategyResult.idealLeadProfile.hasWebsite ? 'Var' : 'Yok'}</span></div>
                            </div>
                        </div>

                        {/* Next Move */}
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Tahmini Dönüşüm</div>
                                <div className="text-sm font-bold text-emerald-400">{strategyResult.actionPlan.estimatedConversion}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Kalite Beklentisi</div>
                                <div className="text-sm font-bold text-indigo-400">{strategyResult.actionPlan.expectedLeadQuality}</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <Activity size={32} className="text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500 mb-4">Henüz stratejik analiz yapılmadı.</p>
                        <button 
                            onClick={loadStrategy}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Analizi Başlat
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800">Günlük Etkileşim Analizi</h3>
            <span className="text-xs text-slate-500">Son 7 Gün</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sent" fill="#6366f1" radius={[4, 4, 0, 0]} name="Mail Gönderildi" barSize={32} />
                <Bar dataKey="response" fill="#10b981" radius={[4, 4, 0, 0]} name="Yanıt Alındı" barSize={32} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-indigo-600"/> Bölgesel Hakimiyet
          </h3>
          <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                          <th className="px-3 py-2 rounded-l-lg">Bölge</th>
                          <th className="px-3 py-2">Lead</th>
                          <th className="px-3 py-2 rounded-r-lg">Dönüşüm</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {stats.districtBreakdown?.slice(0, 6).map((region, i) => (
                          <tr key={i}>
                              <td className="px-3 py-3 font-medium text-slate-800">{region.name}</td>
                              <td className="px-3 py-3 text-slate-600">{region.totalLeads}</td>
                              <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${region.conversionRate}%` }}></div>
                                      </div>
                                      <span className="text-xs font-bold text-emerald-600">%{region.conversionRate.toFixed(0)}</span>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {(!stats.districtBreakdown || stats.districtBreakdown.length === 0) && (
                          <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">Veri yok</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
        </div>
      </div>

      {/* NEW SECTION: Recent Emails Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Mail size={18} className="text-purple-600"/> Son Gönderilen İletiler
              </h3>
              <span className="text-xs text-slate-500">Son 10 İşlem</span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                          <th className="px-4 py-3 rounded-l-lg">Saat</th>
                          <th className="px-4 py-3">Firma (Lead)</th>
                          <th className="px-4 py-3">Konu / İçerik</th>
                          <th className="px-4 py-3 rounded-r-lg">Durum</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {recentInteractions.filter(i => i.type === 'email').length > 0 ? (
                          recentInteractions.filter(i => i.type === 'email').map((interaction) => (
                              <tr key={interaction.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                      <div className="flex items-center gap-1">
                                          <Clock size={12} /> {interaction.time}
                                          <span className="text-[10px] text-slate-400 ml-1">{new Date(interaction.date).toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'})}</span>
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-slate-800">
                                      {getLeadName(interaction.leadId)}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 truncate max-w-[300px]" title={interaction.summary}>
                                      {interaction.summary}
                                  </td>
                                  <td className="px-4 py-3">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                                          interaction.status === 'sent' || interaction.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                          interaction.status === 'read' ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-100 text-slate-600'
                                      }`}>
                                          {interaction.status === 'sent' && <CheckCircle size={10} />}
                                          {interaction.status === 'failed' && <AlertCircle size={10} />}
                                          {interaction.status === 'sent' ? 'Gönderildi' : interaction.status}
                                      </span>
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                  Henüz mail gönderimi yapılmadı.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
