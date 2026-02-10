
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
  PlayCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { api } from '../services/api';
import { DashboardStats, ActionLog, Lead } from '../types';
import EmptyState from '../components/EmptyState';
import { useAgent } from '../context/AgentContext';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Connect to Agent Context for Live Thoughts
  const { thoughts, isAgentRunning, toggleAgent } = useAgent();
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Briefing State
  const [briefingStatus, setBriefingStatus] = useState<'idle' | 'loading' | 'playing'>('idle');

  // Strategy Insights State
  const [insights, setInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);

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
            const [statsData, leadsData, reportData] = await Promise.all([
                api.dashboard.getStats(),
                api.leads.getAll(),
                api.reports.getPerformanceData()
            ]);
            setStats(statsData);
            setLeads(leadsData);
            
            // Map report weekly trend to chart format
            const mappedChartData = reportData.weeklyTrend.map((item: any) => ({
                name: item.name,
                sent: item.sent,
                response: item.response
            }));
            setChartData(mappedChartData);
            
            if (leadsData.length > 5) {
                loadInsights();
            }
        } catch (e) {
            console.error("Dashboard data load error", e);
        } finally {
            setLoading(false);
        }
    };
    fetchDashboardData();
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
      if (thoughtsEndRef.current) {
          thoughtsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [thoughts]);

  const loadInsights = async () => {
      setLoadingInsights(true);
      try {
          const data = await api.strategy.getInsights();
          setInsights(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingInsights(false);
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

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full min-h-[500px]">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
      );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
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

      {/* Top Stats Cards */}
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
        
        {/* LIVE NEURO-TERMINAL (Replaces Action Log) */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-800 h-[400px]">
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
                        GEMINI-2.5-FLASH-PREVIEW // {isGeminiConfigured ? 'CONFIGURED' : 'API KEY MISSING'}
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
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3 bg-slate-900/50 relative">
                {/* Background Grid */}
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
                <div ref={thoughtsEndRef} />
            </div>
        </div>

        {/* AI STRATEGY WIDGET (Compact) */}
        <div className="relative rounded-2xl shadow-xl p-6 text-white overflow-hidden group h-[400px] flex flex-col bg-gradient-to-br from-indigo-900 to-purple-900">
            {/* Glass Background */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full blur-[100px] opacity-10"></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <BrainCircuit className="text-indigo-300" size={20} />
                    Strateji Odası
                </h3>
                <button 
                  onClick={loadInsights} 
                  disabled={loadingInsights}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                >
                    {loadingInsights ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 relative z-10 custom-scrollbar pr-2">
                {insights.length > 0 ? (
                    insights.map((insight, idx) => (
                        <div key={idx} className="bg-black/20 backdrop-blur-md rounded-xl p-4 border border-white/5 hover:bg-black/30 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    insight.type === 'opportunity' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' :
                                    'bg-blue-500/20 text-blue-200 border-blue-500/30'
                                }`}>
                                    {insight.type === 'opportunity' ? 'Fırsat' : 'İpucu'}
                                </span>
                            </div>
                            <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                            <p className="text-xs text-indigo-100 opacity-80 leading-relaxed">{insight.description}</p>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-indigo-200 text-sm">
                        <Lightbulb size={24} className="mx-auto mb-2 opacity-50" />
                        <p>Yeterli veri toplanıyor...</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800">Günlük Etkileşim Analizi</h3>
            <span className="text-xs text-slate-500">Son 7 Gün</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sent" fill="#6366f1" radius={[4, 4, 0, 0]} name="Mail Gönderildi" barSize={32} />
                <Bar dataKey="response" fill="#10b981" radius={[4, 4, 0, 0]} name="Yanıt Alındı" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Performance Table */}
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
    </div>
  );
};

export default Dashboard;
