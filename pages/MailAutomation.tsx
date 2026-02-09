
import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle, Pause, Play, RefreshCw, User, ChevronRight, MapPin, CalendarClock, Send, Loader2, Zap, Filter, Wand2, Sparkles, PenTool, Layout, Plus, Edit2, Trash2, Save, FileText, BarChart2, MessageSquare, ThumbsUp, XCircle, Eye, TestTube, ArrowUpRight, ArrowRight, MousePointerClick, Star, BrainCircuit, Image as ImageIcon, Check, X, TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import { Lead, Interaction, EmailTemplate, TemplateStats, ABVariant } from '../types';
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, SECTORS } from '../constants';
import { useAgent } from '../context/AgentContext';
import { storage } from '../services/storage';
import EmptyState from '../components/EmptyState';

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

// --- HELPER FUNCTIONS ---

const getDaysDifference = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// --- COMPONENT ---

interface QueueItem {
    id: string;
    lead: Lead;
    template: 'intro' | 'followup1' | 'followup2';
    reason: string;
    status: 'pending' | 'sending' | 'sent' | 'error' | 'waiting_assets';
    generatedContent?: { subject: string; body: string };
}

const MailAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approval' | 'queue' | 'templates' | 'lab'>('queue');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  
  // Template Management State
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Approval State
  const [selectedDraft, setSelectedDraft] = useState<Lead | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isSendingDraft, setIsSendingDraft] = useState(false);

  // Lab State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [abVariants, setAbVariants] = useState<ABVariant[]>([]);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      try {
          const [leadsData, templatesData] = await Promise.all([
              api.leads.getAll(),
              api.templates.getAll()
          ]);
          setLeads(leadsData);
          setTemplates(templatesData);
          if (templatesData.length > 0 && !selectedTemplateId) setSelectedTemplateId(templatesData[0].id);
          calculateQueue(leadsData);
      } catch (error) {
          console.error("Data load failed", error);
      } finally {
          setLoading(false);
      }
  };

  const calculateQueue = (leadsData: Lead[]) => {
      const newQueue: QueueItem[] = [];
      leadsData.forEach(lead => {
          if (!lead.email) return;

          // Rule 1: Active & No Contact -> Intro
          if (lead.lead_durumu === 'aktif' && !lead.son_kontakt_tarihi) {
              const needsVisual = !lead.generatedHeroImage;
              newQueue.push({
                  id: `q-${lead.id}-intro`,
                  lead,
                  template: 'intro',
                  reason: needsVisual ? 'Görsel Hazırlanıyor' : 'Yeni Lead (Hazır)',
                  status: needsVisual ? 'waiting_assets' : 'pending'
              });
          }
          // Rule 2: Active & Contacted > 3 days ago -> Follow-up 1
          else if (lead.lead_durumu === 'takipte' && lead.son_kontakt_tarihi) {
              const daysSince = getDaysDifference(lead.son_kontakt_tarihi);
              
              if (daysSince >= 3 && daysSince < 7) {
                   newQueue.push({
                      id: `q-${lead.id}-f1`,
                      lead,
                      template: 'followup1',
                      reason: `Son temas ${daysSince} gün önce`,
                      status: 'pending'
                  });
              } else if (daysSince >= 7) {
                  newQueue.push({
                      id: `q-${lead.id}-f2`,
                      lead,
                      template: 'followup2',
                      reason: `Son temas ${daysSince} gün önce`,
                      status: 'pending'
                  });
              }
          }
      });
      setQueue(newQueue);
  };

  // --- MAILING LOGIC (QUEUE) ---
  const applyTemplate = (lead: Lead, type: string) => {
      const template = templates.find(t => t.type === type && t.isActive) || templates[0];
      if (!template) return { subject: 'Merhaba', body: '...' };
      let body = template.body.replace(/{firma_adi}/g, lead.firma_adi).replace(/{yetkili}/g, lead.yetkili_adi || 'Yetkili').replace(/{ilce}/g, lead.ilce);
      return { subject: template.subject.replace(/{firma_adi}/g, lead.firma_adi), body, templateId: template.id };
  };

  const processQueueItem = async (item: QueueItem) => {
      if (item.status === 'waiting_assets') return; 
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sending' } : q));

      try {
          const content = applyTemplate(item.lead, item.template);
          
          let attachments = [];
          if (item.lead.generatedHeroImage) {
               const base64Content = item.lead.generatedHeroImage.split(',')[1];
               attachments.push({ filename: 'onizleme.png', content: base64Content, mimeType: 'image/png' });
          }

          await api.gmail.send(item.lead.email, content.subject, content.body, attachments);

          const updatedLead = { 
              ...item.lead, 
              lead_durumu: 'takipte' as any, 
              son_kontakt_tarihi: new Date().toISOString().slice(0, 10),
              lastUsedTemplateId: content.templateId
          };
          await api.leads.update(updatedLead);
          
          // Increment template usage
          if (content.templateId) {
              // Note: storage service handles stats increment, but UI needs reload or local update
              // We just refresh data for simplicity
          }

          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sent' } : q));
          loadData(); // Refresh to update leads list
          
      } catch (error) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
      }
  };

  // --- APPROVAL LOGIC ---
  const openDraft = (lead: Lead) => {
      if (lead.draftResponse) {
          setSelectedDraft(lead);
          setDraftSubject(lead.draftResponse.subject);
          setDraftBody(lead.draftResponse.body);
      }
  };

  const handleApproveSend = async () => {
      if (!selectedDraft) return;
      setIsSendingDraft(true);

      try {
          await api.gmail.send(selectedDraft.email, draftSubject, draftBody);
          
          // Update Lead
          const updatedLead: Lead = {
              ...selectedDraft,
              lead_durumu: 'takipte', // or 'teklif_gonderildi' depending on intent, but 'takipte' is safe
              draftResponse: undefined, // Clear draft
              son_kontakt_tarihi: new Date().toISOString().slice(0, 10)
          };
          
          await api.leads.update(updatedLead);
          
          // Log
          await api.dashboard.logAction('Yanıt Onaylandı', `${selectedDraft.firma_adi} mail gönderildi`, 'success');
          
          setSelectedDraft(null);
          loadData();
      } catch (error) {
          console.error(error);
          alert("Gönderim başarısız.");
      } finally {
          setIsSendingDraft(false);
      }
  };

  const handleDiscardDraft = async () => {
      if (!selectedDraft) return;
      if (confirm("Bu taslağı silmek istediğinize emin misiniz?")) {
          const updatedLead: Lead = {
              ...selectedDraft,
              draftResponse: undefined,
              lead_durumu: 'takipte' // Revert to follow-up status
          };
          await api.leads.update(updatedLead);
          setSelectedDraft(null);
          loadData();
      }
  };

  // --- TEMPLATE LOGIC ---
  const handleSaveTemplate = async () => {
      if (!editingTemplate || !editingTemplate.name || !editingTemplate.subject) return;
      
      const newTemplate: EmailTemplate = {
          id: editingTemplate.id || Math.random().toString(36).substr(2, 9),
          name: editingTemplate.name,
          type: editingTemplate.type || 'intro',
          subject: editingTemplate.subject,
          body: editingTemplate.body || '',
          isActive: editingTemplate.isActive ?? true,
          useCount: editingTemplate.useCount || 0,
          successCount: editingTemplate.successCount || 0,
          origin: 'human',
          iteration: 1
      };

      if (editingTemplate.id) {
          await api.templates.update(newTemplate);
      } else {
          await api.templates.save(newTemplate);
      }
      
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      loadData();
  };

  const handleDeleteTemplate = async (id: string) => {
      if (confirm("Şablonu silmek istediğinize emin misiniz?")) {
          await api.templates.delete(id);
          loadData();
      }
  };

  // --- A/B LAB LOGIC (Existing) ---
  const handleGenerateVariants = async () => {
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      if (!currentTemplate) return;

      setIsGeneratingVariants(true);
      try {
          const variants = await api.templates.generateABVariants(currentTemplate);
          setAbVariants(variants);
      } catch (error) {
          console.error(error);
          alert("Varyasyon oluşturulamadı.");
      } finally {
          setIsGeneratingVariants(false);
      }
  };

  const handleApplyVariant = async (variant: ABVariant) => {
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      if (!currentTemplate) return;

      if(confirm(`"${currentTemplate.name}" şablonu seçilen varyasyon ile güncellensin mi?`)) {
          const updatedTemplate: EmailTemplate = {
              ...currentTemplate,
              subject: variant.subject,
              body: variant.body,
              iteration: (currentTemplate.iteration || 1) + 1,
              performanceScore: variant.predictedOpenRate,
              origin: 'ai_auto'
          };
          
          await api.templates.update(updatedTemplate);
          setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
          setAbVariants([]);
          alert("Şablon güncellendi!");
      }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin inline text-indigo-600"/></div>;

  const drafts = leads.filter(l => l.lead_durumu === 'onay_bekliyor' && l.draftResponse);
  const activeTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6 overflow-x-auto">
          {(['queue', 'approval', 'templates', 'lab'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'queue' && <Clock size={16}/>}
                  {tab === 'approval' && <CheckCircle size={16}/>}
                  {tab === 'templates' && <FileText size={16}/>}
                  {tab === 'lab' && <TestTube size={16}/>}
                  {tab === 'queue' ? 'Kuyruk' : tab === 'approval' ? 'Yanıt Onayı' : tab === 'templates' ? 'Şablonlar' : 'A/B Lab'}
                  {tab === 'approval' && drafts.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{drafts.length}</span>}
              </button>
          ))}
      </div>

      {activeTab === 'queue' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">Akıllı Kuyruk</h3>
                      <p className="text-sm text-slate-500">Otomatik gönderim bekleyen iletiler.</p>
                  </div>
                  <button onClick={() => calculateQueue(leads)} className="p-2 bg-slate-100 rounded hover:bg-slate-200"><RefreshCw size={16}/></button>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b text-slate-500">
                          <tr>
                              <th className="px-6 py-3">Firma</th>
                              <th className="px-6 py-3">Durum</th>
                              <th className="px-6 py-3">Sebep</th>
                              <th className="px-6 py-3">Aksiyon</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {queue.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-3 font-medium">{item.lead.firma_adi}</td>
                                  <td className="px-6 py-3">
                                      {item.status === 'waiting_assets' ? (
                                          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                                              <ImageIcon size={12}/> Görsel Bekliyor
                                          </span>
                                      ) : item.status === 'pending' ? (
                                          <span className="text-slate-500 flex items-center gap-1"><Clock size={12}/> Sırada</span>
                                      ) : (
                                          <span className="text-green-600 font-bold flex items-center gap-1"><Check size={12}/> Gönderildi</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-3 text-slate-500 text-xs">{item.reason}</td>
                                  <td className="px-6 py-3">
                                      {item.status === 'pending' && (
                                          <button onClick={() => processQueueItem(item)} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50 transition-colors">Şimdi Gönder</button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {queue.length === 0 && <EmptyState icon={Mail} title="Kuyruk Boş" description="Şu an gönderim bekleyen mail yok. Ajan yeni leadler buldukça buraya ekleyecektir." />}
              </div>
          </div>
      )}
      
      {activeTab === 'approval' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              {/* List */}
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="font-bold text-slate-800">Bekleyen Yanıtlar</h3>
                      <p className="text-xs text-slate-500">{drafts.length} adet onay bekliyor</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      {drafts.length > 0 ? drafts.map(draft => (
                          <div 
                            key={draft.id} 
                            onClick={() => openDraft(draft)}
                            className={`p-4 border-b cursor-pointer transition-colors hover:bg-indigo-50 ${selectedDraft?.id === draft.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <span className="font-bold text-slate-800 text-sm">{draft.firma_adi}</span>
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                      {draft.draftResponse?.intent || 'Genel'}
                                  </span>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1">{draft.draftResponse?.subject}</p>
                              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                  <Clock size={10}/> {new Date(draft.draftResponse?.created_at || '').toLocaleTimeString()}
                              </p>
                          </div>
                      )) : (
                          <div className="p-8 text-center text-slate-400">
                              <CheckCircle size={32} className="mx-auto mb-2 opacity-20"/>
                              <p className="text-sm">Onay bekleyen taslak yok.</p>
                          </div>
                      )}
                  </div>
              </div>

              {/* Editor */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  {selectedDraft ? (
                      <>
                          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                      {selectedDraft.firma_adi.charAt(0)}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900">{selectedDraft.firma_adi}</h3>
                                      <p className="text-xs text-slate-500">{selectedDraft.email}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={handleDiscardDraft} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                                      <Trash2 size={18} />
                                  </button>
                              </div>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-6 space-y-6">
                              {/* Context Box */}
                              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-600">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                      <MessageSquare size={12}/> Bağlam / Son Mesajlar
                                  </h4>
                                  <p className="whitespace-pre-wrap italic">
                                      {selectedDraft.notlar || "Geçmiş mesaj kaydı bulunamadı."}
                                  </p>
                              </div>

                              <div className="space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Konu</label>
                                      <input 
                                          value={draftSubject} 
                                          onChange={(e) => setDraftSubject(e.target.value)}
                                          className="w-full p-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">İçerik</label>
                                      <textarea 
                                          value={draftBody} 
                                          onChange={(e) => setDraftBody(e.target.value)}
                                          className="w-full h-48 p-3 border border-slate-300 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                      />
                                  </div>
                              </div>
                          </div>

                          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                              <button 
                                  onClick={handleApproveSend}
                                  disabled={isSendingDraft}
                                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70"
                              >
                                  {isSendingDraft ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                                  {isSendingDraft ? 'Gönderiliyor...' : 'Onayla ve Gönder'}
                              </button>
                          </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <MousePointerClick size={48} className="mb-4 opacity-20"/>
                          <p>Düzenlemek için soldan bir taslak seçin.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'templates' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">E-Posta Şablonları</h3>
                      <p className="text-sm text-slate-500">Ajanın kullandığı iletişim senaryoları.</p>
                  </div>
                  <button 
                    onClick={() => { setEditingTemplate({}); setIsTemplateModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                      <Plus size={16} /> Yeni Şablon
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map(tpl => {
                      const successRate = tpl.useCount > 0 ? Math.round((tpl.successCount / tpl.useCount) * 100) : 0;
                      return (
                          <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow group relative">
                              <div className="flex justify-between items-start mb-3">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      tpl.type === 'intro' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                      {tpl.type === 'intro' ? 'Tanışma' : 'Takip'}
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                      <button onClick={() => { setEditingTemplate(tpl); setIsTemplateModalOpen(true); }} className="text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>
                                      <button onClick={() => handleDeleteTemplate(tpl.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                                  </div>
                              </div>
                              
                              <h4 className="font-bold text-slate-800 mb-2 truncate" title={tpl.name}>{tpl.name}</h4>
                              <p className="text-xs text-slate-500 mb-4 line-clamp-2 italic">"{tpl.subject}"</p>
                              
                              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                                  <div className="flex items-center gap-1 text-slate-500">
                                      <Send size={12}/> {tpl.useCount} Gönderim
                                  </div>
                                  <div className={`flex items-center gap-1 font-bold ${
                                      successRate > 20 ? 'text-green-600' : successRate > 10 ? 'text-yellow-600' : 'text-slate-400'
                                  }`}>
                                      <TrendingUp size={12}/> %{successRate} Başarı
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
      
      {activeTab === 'lab' && (
          <div className="space-y-8">
              <div className="bg-indigo-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                      <div>
                          <h3 className="text-2xl font-bold flex items-center gap-2 mb-2">
                              <TestTube className="text-pink-400" /> A/B Test Laboratuvarı
                          </h3>
                          <p className="text-indigo-200 text-sm max-w-lg">
                              Mevcut şablonlarınızı yapay zeka ile yarıştırın. AI, açılma oranını artıracak 2 alternatif varyasyon üretir ve en iyisini seçmenizi sağlar.
                          </p>
                      </div>
                      <div className="flex gap-4 items-center bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                          <select 
                              value={selectedTemplateId} 
                              onChange={(e) => { setSelectedTemplateId(e.target.value); setAbVariants([]); }}
                              className="bg-transparent border-none text-white font-medium outline-none text-sm p-2 w-48"
                          >
                              {templates.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>)}
                          </select>
                          <button 
                              onClick={handleGenerateVariants} 
                              disabled={isGeneratingVariants || !selectedTemplateId}
                              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                          >
                              {isGeneratingVariants ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                              Varyasyon Üret
                          </button>
                      </div>
                  </div>
              </div>

              {activeTemplate && abVariants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* ORIGINAL */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-6 relative opacity-70 hover:opacity-100 transition-opacity">
                          <div className="absolute -top-3 left-6 bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                              Mevcut (Orijinal)
                          </div>
                          <div className="mt-4 space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase">Konu</label>
                                  <p className="font-medium text-slate-800">{activeTemplate.subject}</p>
                              </div>
                              <div className="h-32 overflow-y-auto text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                  {activeTemplate.body}
                              </div>
                              <div className="pt-4 border-t border-slate-100 flex justify-center">
                                  <span className="text-xs text-slate-400">Referans</span>
                              </div>
                          </div>
                      </div>

                      {/* VARIANTS */}
                      {abVariants.map((variant, idx) => (
                          <div key={variant.id} className={`bg-white border-2 rounded-xl p-6 relative shadow-lg transform hover:-translate-y-1 transition-all ${
                              idx === 0 ? 'border-blue-200 ring-1 ring-blue-100' : 'border-purple-200 ring-1 ring-purple-100'
                          }`}>
                              <div className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white ${
                                  idx === 0 ? 'bg-blue-500' : 'bg-purple-500'
                              }`}>
                                  Varyasyon {idx === 0 ? 'A' : 'B'}
                              </div>
                              
                              <div className="mt-4 space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase">Konu</label>
                                      <p className="font-medium text-slate-800">{variant.subject}</p>
                                  </div>
                                  <div className="h-32 overflow-y-auto text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                      {variant.body}
                                  </div>
                                  
                                  {/* AI Score */}
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                      <div className="flex justify-between items-center mb-1">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                              <BrainCircuit size={12}/> AI Skoru
                                          </span>
                                          <span className="text-sm font-bold text-green-600">%{variant.predictedOpenRate}</span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                          <div className="bg-green-500 h-full rounded-full" style={{ width: `${variant.predictedOpenRate}%` }}></div>
                                      </div>
                                      <p className="text-[10px] text-slate-500 mt-2 leading-tight italic">
                                          "{variant.reasoning}"
                                      </p>
                                  </div>

                                  <button 
                                      onClick={() => handleApplyVariant(variant)}
                                      className={`w-full py-2 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-colors ${
                                          idx === 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                                      }`}
                                  >
                                      <Check size={16} /> Bu Varyasyonu Seç
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <TestTube size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">Bir şablon seçin ve "Varyasyon Üret" butonuna basın.</p>
                  </div>
              )}
          </div>
      )}

      {/* TEMPLATE EDIT MODAL */}
      {isTemplateModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-900">{editingTemplate?.id ? 'Şablon Düzenle' : 'Yeni Şablon'}</h3>
                      <button onClick={() => setIsTemplateModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Şablon Adı</label>
                          <input 
                              value={editingTemplate?.name || ''} 
                              onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                              placeholder="Örn: Restoran Tanışma v2"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tip</label>
                          <select 
                              value={editingTemplate?.type || 'intro'}
                              onChange={e => setEditingTemplate(prev => ({ ...prev, type: e.target.value as any }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                          >
                              <option value="intro">Tanışma (Intro)</option>
                              <option value="followup1">Takip 1</option>
                              <option value="followup2">Takip 2</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-Posta Konusu</label>
                          <input 
                              value={editingTemplate?.subject || ''} 
                              onChange={e => setEditingTemplate(prev => ({ ...prev, subject: e.target.value }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                              placeholder="Müşterinin göreceği konu"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">İçerik</label>
                          <textarea 
                              value={editingTemplate?.body || ''} 
                              onChange={e => setEditingTemplate(prev => ({ ...prev, body: e.target.value }))}
                              rows={6}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm leading-relaxed resize-none"
                              placeholder="{firma_adi}, {yetkili} gibi değişkenler kullanabilirsiniz."
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Değişkenler: {'{firma_adi}'}, {'{yetkili}'}, {'{ilce}'}</p>
                      </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                      <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-200 rounded-lg">İptal</button>
                      <button onClick={handleSaveTemplate} className="px-4 py-2 bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 rounded-lg">Kaydet</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MailAutomation;
