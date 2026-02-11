
import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Mail, 
  CalendarCheck, 
  BarChart3, 
  Settings, 
  Bot,
  Menu,
  X,
  Zap,
  CheckCircle,
  AlertTriangle,
  Info,
  PlayCircle,
  PauseCircle,
  Loader2,
  Activity,
  Flame,
  Trophy,
  GraduationCap,
  BookOpen,
  Calendar,
  LogOut,
  Sparkles,
  Settings2,
  MapPin,
  Building2,
  Target
} from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { gamificationService } from '../services/gamificationService';
import { firebaseService } from '../services/firebaseService';
import { UserProgress, AgentConfig } from '../types';
import { DISTRICTS, SECTORS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  toggleAssistant: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, toggleAssistant }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAgentRunning, agentStatus, notifications, dismissNotification, toggleAgent, pendingDraftsCount, agentConfig, updateAgentConfig } = useAgent();
  
  // Agent Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  // Gamification State
  const [progress, setProgress] = useState<UserProgress>(gamificationService.getProgress());

  // Refresh progress occasionally
  useEffect(() => {
      const interval = setInterval(() => {
          setProgress(gamificationService.getProgress());
      }, 5000);
      return () => clearInterval(interval);
  }, []);

  // Click outside to close config
  useEffect(() => {
      function handleClickOutside(event: any) {
          if (configRef.current && !configRef.current.contains(event.target)) {
              setIsConfigOpen(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [configRef]);

  const handleLogout = async () => {
      if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
          await firebaseService.logout();
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('localMode');
          navigate('/login');
      }
  };

  const navItems = [
    { name: 'Genel Bakış', path: '/', icon: LayoutDashboard },
    { name: 'Lead Yönetimi', path: '/leads', icon: Users },
    { name: 'Mail Otomasyonu', path: '/mail', icon: Mail, badge: pendingDraftsCount > 0 ? pendingDraftsCount : undefined },
    { name: 'Takvim & Ajanda', path: '/calendar', icon: Calendar }, 
    { name: 'Görev Listesi', path: '/tasks', icon: CalendarCheck },
    { name: 'Eğitim & Simülasyon', path: '/training', icon: GraduationCap },
    { name: 'Raporlama', path: '/reports', icon: BarChart3 },
    { name: 'Kullanım Rehberi', path: '/guide', icon: BookOpen }, 
    { name: 'Ayarlar', path: '/settings', icon: Settings },
  ];

  const dailyGoalPercent = Math.min(100, Math.round((progress.dailyActions.leads / 100) * 100));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:transform-none flex flex-col shadow-2xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)'
        }}
      >
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
                <span className="font-bold text-lg tracking-tight block leading-none">Sales Agent</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Dashboard</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Gamification Widget */}
        <div className="mx-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm mb-2">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Trophy size={12} className="text-yellow-500" /> Günlük Hedef
                </span>
                <div className="flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">
                    <Flame size={12} className={progress.streakDays > 0 ? "fill-orange-400 animate-pulse" : ""} />
                    <span className="text-[10px] font-bold">{progress.streakDays} Gün</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative w-10 h-10 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-700" />
                        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-emerald-500 transition-all duration-1000 ease-out" strokeDasharray={100} strokeDashoffset={100 - (dailyGoalPercent)} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                        %{dailyGoalPercent}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{progress.dailyActions.leads} / 100 Lead</div>
                    <div className="w-full bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style={{ width: `${(progress.xp % 1000) / 10}%` }}></div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>Lvl {progress.level}</span>
                        <span>{progress.xp} XP</span>
                    </div>
                </div>
            </div>
        </div>

        <nav className="px-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-900/50' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="text-sm">{item.name}</span>
                {item.badge && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse border border-rose-400">
                        {item.badge}
                    </span>
                )}
                {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950/30 backdrop-blur-md space-y-3 border-t border-white/5">
          <button 
            onClick={toggleAssistant}
            className="group flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg font-medium transition-all relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <Sparkles size={18} />
            <span className="text-sm">Asistana Sor</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-slate-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-xl font-medium transition-all text-sm"
          >
            <LogOut size={16} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Toast Notifications */}
        <div className="absolute top-24 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
            <div 
              key={n.id} 
              className={`pointer-events-auto w-80 bg-white border-l-4 shadow-xl rounded-lg p-4 transform transition-all duration-300 animate-slide-in-right flex items-start gap-3 backdrop-blur-xl bg-white/90 ${
                n.type === 'success' ? 'border-emerald-500' :
                n.type === 'warning' ? 'border-amber-500' :
                n.type === 'error' ? 'border-red-500' : 'border-blue-500'
              }`}
            >
              <div className="mt-0.5">
                {n.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                {n.type === 'warning' && <Zap size={18} className="text-amber-500" />}
                {n.type === 'error' && <AlertTriangle size={18} className="text-red-500" />}
                {n.type === 'info' && <Info size={18} className="text-blue-500" />}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{n.message}</p>
              </div>
              <button 
                onClick={() => dismissNotification(n.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm z-10 sticky top-0">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-slate-500 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              
              {/* Global Agent Status & Controls */}
              <div className="relative" ref={configRef}>
                  <div 
                    className={`hidden sm:flex items-center gap-3 px-1.5 py-1.5 pl-4 rounded-full border transition-all ${
                      isAgentRunning 
                        ? 'bg-slate-50 border-slate-200 shadow-sm' 
                        : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <div className="flex flex-col items-end min-w-[100px]">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 cursor-pointer" onClick={() => setIsConfigOpen(!isConfigOpen)}>
                            Otopilot
                            {isAgentRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>}
                            <Settings2 size={10} className="text-slate-400 hover:text-indigo-600"/>
                        </span>
                        <span className={`text-xs font-bold truncate max-w-[150px] ${
                            isAgentRunning ? 'text-indigo-600' : 'text-slate-400'
                        }`}>
                            {agentStatus}
                        </span>
                    </div>
                    <button 
                      onClick={toggleAgent}
                      className={`p-2 rounded-full transition-all shadow-sm ${
                          isAgentRunning 
                          ? 'bg-white text-green-600 hover:text-green-700 border border-slate-200' 
                          : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200'
                      }`}
                      title={isAgentRunning ? "Ajanı Duraklat" : "Ajanı Başlat"}
                    >
                      {agentStatus.includes('...') && !agentStatus.includes('Beklemede') ? (
                          <Loader2 size={18} className="animate-spin" />
                      ) : isAgentRunning ? (
                          <PauseCircle size={18} className="fill-green-50" />
                      ) : (
                          <PlayCircle size={18} />
                      )}
                    </button>
                  </div>

                  {/* Config Popover */}
                  {isConfigOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-fade-in origin-top-right">
                          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                              <Target size={16} className="text-indigo-600" /> Hedef Ayarları
                          </h4>
                          
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                                      <MapPin size={12} /> Hedef Bölge
                                  </label>
                                  <select 
                                      className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500"
                                      value={agentConfig.targetDistrict}
                                      onChange={(e) => updateAgentConfig({ targetDistrict: e.target.value })}
                                  >
                                      <option value="Tümü">Tüm İstanbul</option>
                                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                                      <Building2 size={12} /> Hedef Sektör
                                  </label>
                                  <select 
                                      className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500"
                                      value={agentConfig.targetSector}
                                      onChange={(e) => updateAgentConfig({ targetSector: e.target.value })}
                                  >
                                      <option value="Tümü">Tüm Sektörler</option>
                                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                                      <Target size={12} /> Çalışma Modu
                                  </label>
                                  <select
                                      className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500"
                                      value={agentConfig.focusMode}
                                      onChange={(e) => updateAgentConfig({ focusMode: e.target.value as AgentConfig['focusMode'] })}
                                  >
                                      <option value="balanced">Dengeli</option>
                                      <option value="discovery_only">Sadece Keşif</option>
                                      <option value="outreach_only">Sadece Outreach</option>
                                  </select>
                              </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-[10px] text-slate-400">
                                  Ajan seçili bölge/sektöre göre çalışır; mod seçimi keşif ve outreach adımlarını sınırlar.
                              </p>
                          </div>
                      </div>
                  )}
              </div>

              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold border border-white shadow-sm cursor-help transition-transform hover:scale-105" title={localStorage.getItem('localMode') ? 'Yerel Mod' : 'Firebase Bağlı'}>
                {localStorage.getItem('localMode') ? 'YM' : 'FB'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
