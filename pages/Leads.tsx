
import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileSpreadsheet, MoreVertical, Mail, Phone, Edit, 
  X, MessageCircle, ArrowRight, Clock, CheckCheck, Eye, Save, Loader2, FileText, Globe, Sparkles, AlertCircle,
  StickyNote, Calendar, CheckSquare, ChevronRight, User, MapPin, Building2, LayoutGrid, List, GripVertical, BrainCircuit, Navigation, Map,
  TrendingUp, ShieldAlert, Award, Target, PenTool, GripHorizontal, Ghost, Shield, Zap, SearchCheck, Flame, Image as ImageIcon, Instagram, Copy
} from 'lucide-react';
import { MOCK_INTERACTIONS } from '../services/mockService'; 
import { api } from '../services/api';
import { STATUS_COLORS, SECTORS, DISTRICTS, DISTRICT_COORDINATES, SYSTEM_PROMPT } from '../constants';
import { Lead, Task, LeadStatus } from '../types';
import ProposalModal from '../components/ProposalModal';
import LeadDiscoveryModal from '../components/LeadDiscoveryModal';
import ResponseAnalyzerModal from '../components/ResponseAnalyzerModal';
import ContentStudio from '../components/ContentStudio';
import SmartAdvisor from '../components/SmartAdvisor';
import Confetti from '../components/Confetti';
import EmptyState from '../components/EmptyState';
import { GoogleGenAI } from "@google/genai";

// --- SMART SCORING ENGINE ---
const calculateSmartScore = (lead: Partial<Lead>): number => {
    let score = 1; // Base score

    // 1. Contact Info Weight
    if (lead.email) score += 2;
    if (lead.telefon) score += 1;
    if (lead.websitesi_var_mi === 'Hayır') score += 1; // Opportunity

    // 2. Sector Weight (High Ticket/Conversion)
    if (['Sağlık', 'Emlak'].includes(lead.sektor || '')) score += 1;

    // 3. SME Priority Check (Negative weight for potential big corps)
    // If name contains words implying large scale, reduce score.
    const bigCorpKeywords = ['Holding', 'Group', 'Global', 'A.Ş.', 'Anonim', 'Zincir'];
    const name = lead.firma_adi || '';
    if (bigCorpKeywords.some(k => name.includes(k))) {
        score -= 1; 
    }

    // Cap at 5, min 1
    return Math.max(1, Math.min(5, score));
};

// --- GEO UTILS ---
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI/180);
};

// --- KANBAN CONFIG ---
const KANBAN_COLUMNS: { id: LeadStatus; label: string; color: string }[] = [
    { id: 'aktif', label: 'Yeni / Aktif', color: 'border-emerald-200 bg-emerald-50' },
    { id: 'takipte', label: 'Takipte', color: 'border-blue-200 bg-blue-50' },
    { id: 'teklif_gonderildi', label: 'Teklif Aşamasında', color: 'border-purple-200 bg-purple-50' },
    { id: 'onay_bekliyor', label: 'Yanıt/Onay Bekliyor', color: 'border-indigo-200 bg-indigo-50' },
    { id: 'olumlu', label: 'Kazanıldı', color: 'border-green-200 bg-green-50' },
    { id: 'olumsuz', label: 'Kaybedildi', color: 'border-red-200 bg-red-50' },
    { id: 'beklemede', label: 'Beklemeye Alındı', color: 'border-amber-200 bg-amber-50' }
];

const Leads: React.FC = () => {
  // View State
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'field'>('table');

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter State
  const [filterText, setFilterText] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Field Mode State
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Detail Panel State
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'showcase' | 'notes' | 'tasks' | 'studio'>('overview');
  const [noteInput, setNoteInput] = useState('');
  const [newTaskInput, setNewTaskInput] = useState({ aciklama: '', tarih: '', oncelik: 'Orta' });
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isAnalyzingCompetitors, setIsAnalyzingCompetitors] = useState(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [isAnalyzingSocial, setIsAnalyzingSocial] = useState(false);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [isAnalyzerModalOpen, setIsAnalyzerModalOpen] = useState(false);
  
  const [proposalLead, setProposalLead] = useState<Lead | null>(null);

  // Enrichment State
  const [isEnriching, setIsEnriching] = useState(false);

  // Gamification State
  const [showConfetti, setShowConfetti] = useState(false);

  // New Lead Form State
  const [newLeadData, setNewLeadData] = useState<Partial<Lead>>({
    firma_adi: '', sektor: 'Diğer', ilce: 'Kadıköy', lead_durumu: 'aktif', lead_skoru: 1
  });
  const [isSaving, setIsSaving] = useState(false);

  // Drag & Drop State
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  // Load Data on Mount
  const loadData = async () => {
    setIsLoading(true);
    try {
        const [leadsData, tasksData] = await Promise.all([
            api.leads.getAll(),
            api.tasks.getAll()
        ]);
        setLeads(leadsData);
        setTasks(tasksData);
    } catch (error) {
        console.error("Failed to fetch data", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- AUTO SCORE UPDATE EFFECT ---
  useEffect(() => {
      const score = calculateSmartScore(newLeadData);
      if (score !== newLeadData.lead_skoru) {
          setNewLeadData(prev => ({ ...prev, lead_skoru: score }));
      }
  }, [newLeadData.email, newLeadData.telefon, newLeadData.sektor, newLeadData.websitesi_var_mi, newLeadData.firma_adi]);

  // --- FIELD MODE LOGIC ---
  const handleFieldModeToggle = () => {
      if (viewMode === 'field') {
          setViewMode('table');
      } else {
          setViewMode('field');
          getUserLocation();
      }
  };

  const getUserLocation = () => {
      if (!navigator.geolocation) {
          alert("Tarayıcınız konum özelliğini desteklemiyor.");
          return;
      }
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              setUserLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
              });
              setIsGettingLocation(false);
          },
          (error) => {
              console.error("Location error", error);
              setIsGettingLocation(false);
              setUserLocation({ lat: 41.0082, lng: 28.9784 });
          }
      );
  };

  const getSortedLeadsByDistance = () => {
      if (!userLocation) return filteredLeads;

      return [...filteredLeads].sort((a, b) => {
          const coordsA = DISTRICT_COORDINATES[a.ilce] || DISTRICT_COORDINATES['İstanbul'];
          const coordsB = DISTRICT_COORDINATES[b.ilce] || DISTRICT_COORDINATES['İstanbul'];
          
          const distA = calculateDistance(userLocation.lat, userLocation.lng, coordsA.lat, coordsA.lng);
          const distB = calculateDistance(userLocation.lat, userLocation.lng, coordsB.lat, coordsB.lng);
          
          return distA - distB;
      });
  };

  const handleCheckIn = async (lead: Lead) => {
      if(confirm(`${lead.firma_adi} için ziyaret kaydı oluşturulsun mu?`)) {
          await api.leads.logInteraction(lead.id, 'phone', 'Saha Ziyareti (Check-in)');
          await api.dashboard.logAction('Saha Ziyareti', `${lead.firma_adi}`, 'success');
          alert('Ziyaret kaydedildi!');
          loadData(); 
      }
  };

  const openDirections = (lead: Lead) => {
      const query = encodeURIComponent(`${lead.firma_adi} ${lead.ilce} İstanbul`);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  // --- COMPETITOR ANALYSIS ---
  const handleCompetitorAnalysis = async (lead: Lead) => {
      setIsAnalyzingCompetitors(true);
      try {
          const result = await api.competitors.analyze(lead);
          const updatedLead = { ...lead, competitorAnalysis: result };
          await api.leads.update(updatedLead);
          setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
          await api.dashboard.logAction('Rakip Analizi', `${lead.firma_adi} için tamamlandı`, 'success');
      } catch (error) {
          console.error("Competitor analysis failed", error);
          alert("Rakip analizi yapılamadı.");
      } finally {
          setIsAnalyzingCompetitors(false);
      }
  };

  // --- VISUAL & SOCIAL ---
  const handleGenerateHeroImage = async (lead: Lead) => {
      setIsGeneratingVisual(true);
      try {
          const imageBase64 = await api.visuals.generateHeroImage(lead);
          const updatedLead = { ...lead, generatedHeroImage: imageBase64 };
          await api.leads.update(updatedLead);
          setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
          await api.dashboard.logAction('Görsel Üretildi', `${lead.firma_adi} için site tasarımı`, 'success');
      } catch (error) {
          console.error(error);
          alert("Görsel üretilemedi. API kotanızı kontrol edin.");
      } finally {
          setIsGeneratingVisual(false);
      }
  };

  const handleInstagramAnalysis = async (lead: Lead) => {
      setIsAnalyzingSocial(true);
      try {
          const result = await api.social.analyzeInstagram(lead);
          const updatedLead = { ...lead, instagramProfile: result };
          await api.leads.update(updatedLead);
          setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
          await api.dashboard.logAction('Instagram Analizi', `${lead.firma_adi}`, 'success');
      } catch (error) {
          console.error(error);
          alert("Instagram analizi yapılamadı.");
      } finally {
          setIsAnalyzingSocial(false);
      }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
      setDraggedLeadId(leadId);
      e.dataTransfer.effectAllowed = "move";
      // Transparent drag image hack if needed, but default is usually fine
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
      e.preventDefault();
      setDragOverColumn(status);
  };

  const handleDrop = async (e: React.DragEvent, status: LeadStatus) => {
      e.preventDefault();
      setDragOverColumn(null);
      
      if (!draggedLeadId) return;

      const lead = leads.find(l => l.id === draggedLeadId);
      if (lead && lead.lead_durumu !== status) {
          // Optimistic Update
          const updatedLead = { ...lead, lead_durumu: status };
          setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
          
          try {
              await api.leads.update(updatedLead);
              // Trigger success confetti if won
              if (status === 'olumlu') {
                  setShowConfetti(true);
                  setTimeout(() => setShowConfetti(false), 5000);
              }
          } catch (error) {
              console.error("Failed to update lead status", error);
              // Revert on error
              setLeads(prev => prev.map(l => l.id === lead.id ? lead : l));
          }
      }
      setDraggedLeadId(null);
  };

  // --- FILTERING ---
  const filteredLeads = leads.filter(lead => {
    const matchesText = lead.firma_adi.toLowerCase().includes(filterText.toLowerCase()) || 
                        lead.yetkili_adi?.toLowerCase().includes(filterText.toLowerCase());
    const matchesSector = selectedSector ? lead.sektor === selectedSector : true;
    return matchesText && matchesSector;
  });

  const activeLead = leads.find(l => l.id === selectedLeadId);

  // Render Logic ...
  return (
    <div className="flex h-[calc(100vh-100px)] animate-fade-in relative">
      {/* List / Board / Field Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedLeadId ? 'mr-96 hidden lg:flex' : ''}`}>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Firma veya yetkili ara..." 
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600">
                    <Filter size={18} />
                </button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}><List size={18}/></button>
                    <button onClick={() => setViewMode('board')} className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
                    <button onClick={handleFieldModeToggle} className={`p-1.5 rounded ${viewMode === 'field' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}><Map size={18}/></button>
                </div>
                <button 
                    onClick={() => setIsDiscoveryModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                >
                    <Globe size={16} /> Keşfet
                </button>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} /> Yeni Ekle
                </button>
            </div>
        </div>

        {/* Content Views */}
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-xl shadow-sm relative">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : filteredLeads.length === 0 ? (
                <EmptyState 
                    icon={Search}
                    title="Lead Bulunamadı"
                    description="Arama kriterlerinize uygun kayıt yok veya listeniz boş."
                    action={{ label: 'Otomatik Lead Keşfet', onClick: () => setIsDiscoveryModalOpen(true) }}
                />
            ) : viewMode === 'field' ? (
                // FIELD VIEW
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isGettingLocation && (
                        <div className="col-span-full text-center py-4 text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={16} /> Konum alınıyor...
                        </div>
                    )}
                    {getSortedLeadsByDistance().map(lead => (
                        <div key={lead.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-all bg-white relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800">{lead.firma_adi}</h4>
                                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${STATUS_COLORS[lead.lead_durumu]}`}>
                                    {lead.lead_durumu.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
                                <MapPin size={12} /> {lead.ilce}, {lead.sektor}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button 
                                    onClick={() => handleCheckIn(lead)}
                                    className="flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100"
                                >
                                    <CheckSquare size={14} /> Check-in
                                </button>
                                <button 
                                    onClick={() => openDirections(lead)}
                                    className="flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100"
                                >
                                    <Navigation size={14} /> Yol Tarifi
                                </button>
                            </div>
                            <button 
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="absolute top-0 left-0 w-full h-full opacity-0"
                            />
                        </div>
                    ))}
                </div>
            ) : viewMode === 'table' ? (
                // TABLE VIEW
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4">Firma Adı</th>
                            <th className="px-6 py-4">Sektör / İlçe</th>
                            <th className="px-6 py-4">Durum</th>
                            <th className="px-6 py-4">Skor</th>
                            <th className="px-6 py-4 text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredLeads.map((lead) => (
                            <tr 
                                key={lead.id} 
                                onClick={() => setSelectedLeadId(lead.id)}
                                className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedLeadId === lead.id ? 'bg-indigo-50/50' : ''}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{lead.firma_adi}</div>
                                    <div className="text-xs text-slate-500">{lead.yetkili_adi || '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">{lead.sektor}</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-600">{lead.ilce}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[lead.lead_durumu]}`}>
                                        {lead.lead_durumu.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-2 h-2 rounded-full ${i < lead.lead_skoru ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-indigo-600 p-1">
                                        <MoreVertical size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                // BOARD VIEW (KANBAN - DRAG & DROP ENABLED)
                <div className="flex p-4 gap-4 h-full overflow-x-auto bg-slate-100/50">
                    {KANBAN_COLUMNS.map(col => (
                        <div 
                            key={col.id} 
                            className={`min-w-[280px] w-[280px] flex flex-col rounded-xl border transition-colors ${
                                dragOverColumn === col.id ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-200'
                            }`}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className={`p-3 font-semibold text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200 bg-white rounded-t-xl flex justify-between`}>
                                {col.label}
                                <span className="bg-slate-100 px-2 py-0.5 rounded-full">{filteredLeads.filter(l => l.lead_durumu === col.id).length}</span>
                            </div>
                            <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                                {filteredLeads.filter(l => l.lead_durumu === col.id).map(lead => (
                                    <div 
                                        key={lead.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        onClick={() => setSelectedLeadId(lead.id)}
                                        className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all active:scale-95 group relative ${
                                            draggedLeadId === lead.id ? 'opacity-50 ring-2 ring-indigo-400 rotate-2' : 'border-slate-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-800 text-sm line-clamp-1">{lead.firma_adi}</span>
                                            {lead.lead_skoru >= 4 && <Flame size={14} className="text-orange-500 flex-shrink-0" />}
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                                            <MapPin size={10} /> {lead.ilce}
                                        </div>
                                        {lead.son_kontakt_tarihi && (
                                            <div className="text-[10px] text-slate-400 border-t border-slate-50 pt-2 flex items-center gap-1">
                                                <Clock size={10} /> {lead.son_kontakt_tarihi}
                                            </div>
                                        )}
                                        <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                                            <GripVertical size={16} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedLeadId && activeLead && (
        <div className="fixed inset-y-0 right-0 w-full lg:w-96 bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 z-20 flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="flex justify-between items-start mb-4">
                    <button onClick={() => setSelectedLeadId(null)} className="text-slate-400 hover:text-slate-600 lg:hidden">
                        <ArrowRight size={20} />
                    </button>
                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => { setProposalLead(activeLead); setIsProposalModalOpen(true); }} className="p-2 bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Teklif Hazırla">
                            <FileText size={18} />
                        </button>
                        <button onClick={() => setIsAnalyzerModalOpen(true)} className="p-2 bg-white border border-slate-200 rounded-lg text-purple-600 hover:bg-purple-50" title="Yanıt Analizi">
                            <MessageCircle size={18} />
                        </button>
                        <button onClick={() => setSelectedLeadId(null)} className="p-2 text-slate-400 hover:text-red-500 hidden lg:block">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-1">{activeLead.firma_adi}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <Building2 size={14} /> {activeLead.sektor}
                    <span className="text-slate-300">•</span>
                    <MapPin size={14} /> {activeLead.ilce}
                </div>

                <SmartAdvisor lead={activeLead} />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Özet
                </button>
                <button 
                    onClick={() => setActiveTab('audit')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Dijital Karne
                </button>
                <button 
                    onClick={() => setActiveTab('showcase')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'showcase' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Vitrin & Sosyal
                </button>
                <button 
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'notes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Notlar
                </button>
                <button 
                    onClick={() => setActiveTab('studio')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'studio' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Stüdyo
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Contact Info */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">İletişim</h4>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <User size={14} />
                                </div>
                                <span className="font-medium">{activeLead.yetkili_adi || 'Yetkili ismi yok'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <Phone size={14} />
                                </div>
                                {activeLead.telefon ? (
                                    <span className="font-mono text-slate-700">{activeLead.telefon}</span>
                                ) : (
                                    <span className="text-red-400 italic text-xs">Telefon eksik</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <Mail size={14} />
                                </div>
                                {activeLead.email ? (
                                    <span className="text-slate-700">{activeLead.email}</span>
                                ) : (
                                    <span className="text-red-400 italic text-xs">Email eksik</span>
                                )}
                            </div>
                        </div>

                        {/* Status Changer */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Durum Değiştir</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {KANBAN_COLUMNS.map(col => (
                                    <button
                                        key={col.id}
                                        onClick={async () => {
                                            const updated = { ...activeLead, lead_durumu: col.id };
                                            await api.leads.update(updated);
                                            setLeads(leads.map(l => l.id === activeLead.id ? updated : l));
                                        }}
                                        className={`px-2 py-1.5 rounded text-xs font-medium text-left transition-colors ${
                                            activeLead.lead_durumu === col.id 
                                            ? 'bg-slate-800 text-white' 
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {col.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div className="space-y-6">
                        {activeLead.competitorAnalysis ? (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm">
                                    <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                                        <BrainCircuit size={18} /> AI Strateji Özeti
                                    </h4>
                                    <p className="text-sm text-slate-700 leading-relaxed italic">
                                        "{activeLead.competitorAnalysis.summary}"
                                    </p>
                                    <div className="mt-3 text-[10px] text-slate-400 text-right">
                                        Son Güncelleme: {new Date(activeLead.competitorAnalysis.lastUpdated).toLocaleDateString()}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Shield size={16} className="text-indigo-600" /> Bölgedeki Güçlü Rakipler
                                    </h4>
                                    <div className="space-y-3">
                                        {activeLead.competitorAnalysis.competitors.map((comp, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-bold text-slate-900 text-sm">{comp.name}</h5>
                                                    <a href={comp.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                        Site <ArrowRight size={10} />
                                                    </a>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="bg-green-50 p-2 rounded text-green-800">
                                                        <strong>+</strong> {comp.strengths[0]}
                                                    </div>
                                                    <div className="bg-red-50 p-2 rounded text-red-800">
                                                        <strong>-</strong> {comp.weaknesses[0]}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleCompetitorAnalysis(activeLead)}
                                    disabled={isAnalyzingCompetitors}
                                    className="w-full py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    {isAnalyzingCompetitors ? 'Güncelleniyor...' : 'Analizi Yenile'}
                                </button>
                            </div>
                        ) : (
                            <EmptyState 
                                icon={SearchCheck}
                                title="Henüz Analiz Yok"
                                description="Bu işletmenin rakiplerini analiz ederek satış şansınızı %40 artırın."
                                action={{ 
                                    label: isAnalyzingCompetitors ? 'Analiz Ediliyor...' : 'Rakip Analizi Başlat', 
                                    onClick: () => handleCompetitorAnalysis(activeLead) 
                                }}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'showcase' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* HERO IMAGE SECTION */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <ImageIcon size={18} className="text-indigo-600" /> Web Tasarım Önizlemesi
                            </h4>
                            
                            {activeLead.generatedHeroImage ? (
                                <div className="group relative rounded-xl overflow-hidden shadow-lg border border-slate-200">
                                    <img src={activeLead.generatedHeroImage} alt="Site Design" className="w-full h-auto object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => window.open(activeLead.generatedHeroImage, '_blank')}
                                            className="px-4 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100"
                                        >
                                            Büyüt
                                        </button>
                                        <button 
                                            onClick={() => handleGenerateHeroImage(activeLead)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                                        >
                                            Yeniden Üret
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50">
                                    <ImageIcon size={32} className="text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500 mb-4">Henüz bir tasarım oluşturulmadı.</p>
                                    <button 
                                        onClick={() => handleGenerateHeroImage(activeLead)}
                                        disabled={isGeneratingVisual}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGeneratingVisual ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        {isGeneratingVisual ? 'Tasarlanıyor...' : 'Taslak Oluştur'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* INSTAGRAM ANALYSIS SECTION */}
                        <div className="space-y-4 pt-6 border-t border-slate-200">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <Instagram size={18} className="text-pink-600" /> Instagram Dedektifi
                            </h4>

                            {activeLead.instagramProfile ? (
                                <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-full -mr-8 -mt-8 opacity-50"></div>
                                    
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{activeLead.instagramProfile.username}</span>
                                            <a href={`https://instagram.com/${activeLead.instagramProfile.username.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-pink-500 hover:text-pink-700">
                                                <ArrowRight size={14} />
                                            </a>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(activeLead.instagramProfile.lastAnalyzed).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 italic border-l-2 border-slate-300">
                                            "{activeLead.instagramProfile.bio}"
                                        </div>
                                        
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Son Paylaşımlar</span>
                                            <p className="text-xs text-slate-700 mt-1">{activeLead.instagramProfile.recentPostTheme}</p>
                                        </div>

                                        <div className="bg-pink-50 p-3 rounded-lg border border-pink-200">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-pink-700 uppercase">Önerilen DM Mesajı</span>
                                                <button 
                                                    onClick={() => navigator.clipboard.writeText(activeLead.instagramProfile?.suggestedDmOpener || '')}
                                                    className="text-pink-600 hover:text-pink-800"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-pink-900 leading-relaxed">
                                                {activeLead.instagramProfile.suggestedDmOpener}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleInstagramAnalysis(activeLead)}
                                        disabled={isAnalyzingSocial}
                                        className="w-full mt-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50"
                                    >
                                        {isAnalyzingSocial ? 'Analiz Ediliyor...' : 'Analizi Yenile'}
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                                    <Search size={24} className="text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-500 mb-4">Profil henüz analiz edilmedi.</p>
                                    <button 
                                        onClick={() => handleInstagramAnalysis(activeLead)}
                                        disabled={isAnalyzingSocial}
                                        className="px-6 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isAnalyzingSocial ? <Loader2 size={16} className="animate-spin" /> : <Instagram size={16} />}
                                        {isAnalyzingSocial ? 'Aranıyor...' : 'Profili Bul & Analiz Et'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="flex flex-col h-full">
                        <textarea 
                            value={activeLead.notlar}
                            readOnly
                            className="flex-1 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600 mb-4 resize-none focus:outline-none"
                            placeholder="Henüz not yok."
                        />
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                placeholder="Not ekle..."
                            />
                            <button 
                                onClick={async () => {
                                    if (!noteInput.trim()) return;
                                    const newNotes = activeLead.notlar ? `${activeLead.notlar}\n- ${noteInput}` : `- ${noteInput}`;
                                    const updated = { ...activeLead, notlar: newNotes };
                                    await api.leads.update(updated);
                                    setLeads(leads.map(l => l.id === activeLead.id ? updated : l));
                                    setNoteInput('');
                                }}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                <Save size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'studio' && (
                    <ContentStudio lead={activeLead} />
                )}
            </div>
        </div>
      )}

      {/* MODALS */}
      <ProposalModal 
        isOpen={isProposalModalOpen} 
        onClose={() => setIsProposalModalOpen(false)} 
        lead={proposalLead}
        onSuccess={() => {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
            loadData();
        }}
      />

      <LeadDiscoveryModal 
        isOpen={isDiscoveryModalOpen}
        onClose={() => setIsDiscoveryModalOpen(false)}
        onLeadsAdded={loadData}
      />

      {isAnalyzerModalOpen && activeLead && (
          <ResponseAnalyzerModal 
            isOpen={isAnalyzerModalOpen}
            onClose={() => setIsAnalyzerModalOpen(false)}
            lead={activeLead}
            onAnalysisComplete={(updatedLead) => {
                setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
            }}
          />
      )}

      {showConfetti && <Confetti />}
    </div>
  );
};

export default Leads;
