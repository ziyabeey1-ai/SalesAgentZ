import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileSpreadsheet, MoreVertical, Mail, Phone, Edit, 
  X, MessageCircle, ArrowRight, Clock, CheckCheck, Eye, Save, Loader2
} from 'lucide-react';
import { MOCK_INTERACTIONS } from '../services/mockService'; // Still using interaction history mock, but could be moved to API too
import { api } from '../services/api';
import { STATUS_COLORS, SECTORS, DISTRICTS } from '../constants';
import { Lead } from '../types';

const Leads: React.FC = () => {
  // State for data manipulation
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState<Partial<Lead>>({
    firma_adi: '', sektor: 'Diğer', ilce: 'Kadıköy', lead_durumu: 'aktif', lead_skoru: 1
  });
  const [isSaving, setIsSaving] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7; 

  // Load Data on Mount
  useEffect(() => {
    const loadLeads = async () => {
        setIsLoading(true);
        try {
            const data = await api.leads.getAll();
            setLeads(data);
        } catch (error) {
            console.error("Failed to fetch leads", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadLeads();
  }, []);

  // --- Actions ---

  const handleExport = () => {
    // Generate simple CSV
    const headers = ['Firma Adı', 'Sektör', 'İlçe', 'Telefon', 'Email', 'Durum'];
    const csvContent = [
      headers.join(','),
      ...leads.map(l => 
        `${l.firma_adi},${l.sektor},${l.ilce},${l.telefon},${l.email},${l.lead_durumu}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleAddLead = async () => {
    if (!newLeadData.firma_adi) return;
    setIsSaving(true);
    
    const newLead: Lead = {
      id: Math.random().toString(36).substr(2, 9),
      firma_adi: newLeadData.firma_adi || 'Yeni Firma',
      sektor: newLeadData.sektor || 'Diğer',
      ilce: newLeadData.ilce || 'Kadıköy',
      telefon: newLeadData.telefon || '',
      email: newLeadData.email || '',
      yetkili_adi: newLeadData.yetkili_adi || '',
      kaynak: 'Google Maps',
      websitesi_var_mi: 'Hayır',
      lead_durumu: 'aktif',
      lead_skoru: 1,
      eksik_alanlar: [],
      son_kontakt_tarihi: new Date().toISOString().slice(0,10)
    };

    try {
        await api.leads.create(newLead);
        setLeads([newLead, ...leads]);
        setIsAddModalOpen(false);
        setNewLeadData({ firma_adi: '', sektor: 'Diğer', ilce: 'Kadıköy', lead_durumu: 'aktif', lead_skoru: 1 });
    } finally {
        setIsSaving(false);
    }
  };

  const handleInteractionClick = async (type: 'email' | 'whatsapp', lead: Lead) => {
      // Log the interaction first
      await api.leads.logInteraction(lead.id, type);
      
      // Then redirect
      if (type === 'email' && lead.email) {
          window.location.href = `mailto:${lead.email}`;
      } else if (type === 'whatsapp' && lead.telefon) {
          window.open(`https://wa.me/${lead.telefon.replace(/\D/g,'')}`, '_blank');
      }
  };

  // --- Filtering & Pagination ---

  const filteredLeads = leads.filter(lead => {
    const matchesText = lead.firma_adi.toLowerCase().includes(filterText.toLowerCase()) || 
                        lead.sektor.toLowerCase().includes(filterText.toLowerCase());
    const matchesSector = selectedSector ? lead.sektor === selectedSector : true;
    return matchesText && matchesSector;
  });

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const leadInteractions = MOCK_INTERACTIONS.filter(i => i.leadId === selectedLeadId).sort((a, b) => {
    return new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime();
  });

  return (
    <div className="space-y-6 relative h-full">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Firma veya sektör ara..." 
              value={filterText}
              onChange={(e) => {
                  setFilterText(e.target.value);
                  setCurrentPage(1); 
              }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="relative">
            <select 
              className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              value={selectedSector}
              onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setCurrentPage(1); 
              }}
            >
              <option value="">Tüm Sektörler</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors w-full sm:w-auto"
          >
            <FileSpreadsheet size={18} />
            Dışa Aktar
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto"
          >
            <Plus size={18} />
            Yeni Lead
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[400px] relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-indigo-600" />
            </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Firma Bilgisi</th>
                <th className="px-6 py-4">Sektör / İlçe</th>
                <th className="px-6 py-4">İletişim</th>
                <th className="px-6 py-4">Skor</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeads.map((lead) => (
                <tr 
                  key={lead.id} 
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedLeadId === lead.id ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`}
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{lead.firma_adi}</span>
                      <span className="text-xs text-slate-500">{lead.kaynak}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-700">{lead.sektor}</span>
                      <span className="text-xs text-slate-500">{lead.ilce}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {lead.email ? (
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600" title={lead.email}>
                          <Mail size={14} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300" title="Email Yok">
                          <Mail size={14} />
                        </div>
                      )}
                      {lead.telefon ? (
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600" title={lead.telefon}>
                          <Phone size={14} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300" title="Telefon Yok">
                          <Phone size={14} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div 
                          key={star} 
                          className={`w-2 h-2 rounded-full ${star <= lead.lead_skoru ? 'bg-orange-400' : 'bg-slate-200'}`} 
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[lead.lead_durumu]}`}>
                      {lead.lead_durumu.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                       >
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && filteredLeads.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Kayıt bulunamadı.
            </div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">Toplam {filteredLeads.length} lead gösteriliyor</span>
          <div className="flex gap-2">
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-sm text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
                Önceki
            </button>
            <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages || totalPages === 0}
                 className="px-3 py-1 bg-white border border-slate-200 rounded text-sm text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
                Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Details Panel */}
      {selectedLead && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedLeadId(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-200">
            {/* Panel Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedLead.firma_adi}</h2>
                <p className="text-sm text-slate-500">{selectedLead.sektor} • {selectedLead.ilce}</p>
              </div>
              <button 
                onClick={() => setSelectedLeadId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Lead Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Yetkili</label>
                  <p className="text-sm font-medium text-slate-900">{selectedLead.yetkili_adi || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Durum</label>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[selectedLead.lead_durumu]}`}>
                      {selectedLead.lead_durumu.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">E-posta</label>
                  <p className="text-sm text-slate-700 flex items-center gap-1.5 break-all">
                    <Mail size={14} className="text-slate-400" />
                    {selectedLead.email || <span className="text-slate-400 italic">Yok</span>}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Telefon</label>
                  <p className="text-sm text-slate-700 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    {selectedLead.telefon || <span className="text-slate-400 italic">Yok</span>}
                  </p>
                </div>
              </div>

              {/* Interaction History Timeline */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-600" />
                  Etkileşim Geçmişi
                </h3>
                
                <div className="relative pl-4 border-l-2 border-slate-100 space-y-8">
                  {leadInteractions.length > 0 ? leadInteractions.map((interaction) => (
                    <div key={interaction.id} className="relative">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[21px] top-0 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center ${
                        interaction.type === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {interaction.type === 'email' ? <Mail size={16} /> : <MessageCircle size={16} />}
                      </div>

                      <div className="pl-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-xs font-bold uppercase tracking-wider ${
                               interaction.direction === 'inbound' ? 'text-emerald-600' : 'text-slate-500'
                             }`}>
                               {interaction.direction === 'inbound' ? 'Gelen' : 'Giden'}
                             </span>
                             <span className="text-xs text-slate-400">•</span>
                             <span className="text-sm font-medium text-slate-900 capitalize">{interaction.type}</span>
                          </div>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            {interaction.date} <span className="w-1 h-1 rounded-full bg-slate-300"></span> {interaction.time}
                          </span>
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm text-slate-700 mt-2">
                          {interaction.summary}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                           {/* Status Badge */}
                           {interaction.status === 'read' && (
                             <span className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                               <CheckCheck size={12} /> Okundu
                             </span>
                           )}
                           {interaction.status === 'delivered' && (
                             <span className="flex items-center gap-1 text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                               <CheckCheck size={12} /> İletildi
                             </span>
                           )}
                            {interaction.status === 'sent' && (
                             <span className="flex items-center gap-1 text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                               <ArrowRight size={12} /> Gönderildi
                             </span>
                           )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-slate-500 italic pl-2">Henüz bir etkileşim kaydı yok.</div>
                  )}
                </div>
              </div>

              {/* Quick Actions Footer inside Panel */}
              <div className="pt-4 mt-auto border-t border-slate-100 grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleInteractionClick('email', selectedLead)}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                     <Mail size={16} /> E-posta Yaz
                  </button>
                  <button 
                    onClick={() => handleInteractionClick('whatsapp', selectedLead)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                     <MessageCircle size={16} /> WhatsApp
                  </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Yeni Lead Ekle</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Firma Adı</label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newLeadData.firma_adi}
                            onChange={(e) => setNewLeadData({...newLeadData, firma_adi: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sektör</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                value={newLeadData.sektor}
                                onChange={(e) => setNewLeadData({...newLeadData, sektor: e.target.value})}
                            >
                                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">İlçe</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                value={newLeadData.ilce}
                                onChange={(e) => setNewLeadData({...newLeadData, ilce: e.target.value})}
                            >
                                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                        <input 
                            type="email" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newLeadData.email}
                            onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                        <input 
                            type="tel" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newLeadData.telefon}
                            onChange={(e) => setNewLeadData({...newLeadData, telefon: e.target.value})}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
                    <button onClick={handleAddLead} disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-70">
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
