
import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Loader2, Sparkles, Send, Clock, Check, AlertTriangle, Eye, ImageIcon, X, UserCircle, BrainCircuit } from 'lucide-react';
import { api } from '../services/api';
import { Lead, EmailTemplate, PersonaType } from '../types';
import EmptyState from '../components/EmptyState';

interface QueueItem {
    id: string;
    lead: Lead;
    template: EmailTemplate;
    score: number;
    status: 'pending' | 'sending' | 'sent' | 'error' | 'waiting_assets';
    reason: string;
    generatedContent?: any;
}

const MailAutomation: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'approval'>('queue');
  const [loading, setLoading] = useState(true);
  
  // Draft / Approval State
  const [selectedDraft, setSelectedDraft] = useState<Lead | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isSendingDraft, setIsSendingDraft] = useState(false);
  
  // Persona Analysis State
  const [analyzingPersonaId, setAnalyzingPersonaId] = useState<string | null>(null);

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
        calculateQueue(leadsData, templatesData);
    } catch (error) {
        console.error("Load failed", error);
    } finally {
        setLoading(false);
    }
  };

  const calculateQueue = (leadsData: Lead[], templatesData: EmailTemplate[]) => {
      const newQueue: QueueItem[] = [];
      const introTemplates = templatesData.filter(t => t.type === 'intro');

      leadsData.forEach(lead => {
          if (lead.lead_durumu !== 'aktif' || introTemplates.length === 0) return;

          const picked = pickSmartIntroTemplate(lead, introTemplates);

          newQueue.push({
              id: `q-${lead.id}`,
              lead,
              template: picked.template,
              score: lead.lead_skoru,
              status: 'pending',
              reason: introTemplates.length > 1
                  ? `Akıllı Taslak Seçimi #${picked.variant + 1} · ${picked.strategy}`
                  : 'Yeni Lead - Dinamik Tanışma'
          });
      });
      
      setQueue(newQueue.sort((a,b) => b.score - a.score));
  };



  const getDeterministicVariant = (lead: Lead, optionCount: number) => {
      if (optionCount <= 1) return 0;
      const key = `${lead.id}-${lead.firma_adi}-${lead.sektor}`;
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
          hash = (hash << 5) - hash + key.charCodeAt(i);
          hash |= 0;
      }
      return Math.abs(hash) % optionCount;
  };

  const getTemplateSectorWinRate = (template: EmailTemplate, sector: string) => {
      const sec = template.sectorStats?.[sector];
      if (sec && sec.useCount > 0) return sec.successCount / sec.useCount;
      if ((template.useCount || 0) > 0) return (template.successCount || 0) / (template.useCount || 1);
      return 0.15; // cold-start default
  };

  const pickSmartIntroTemplate = (lead: Lead, introTemplates: EmailTemplate[]) => {
      if (introTemplates.length === 1) return { template: introTemplates[0], variant: 0, strategy: 'Tek intro şablon mevcut' };

      const scored = introTemplates.map((template, index) => {
          const winRate = getTemplateSectorWinRate(template, lead.sektor);
          const randomizer = getDeterministicVariant({ ...lead, id: `${lead.id}-${template.id}` }, 100) / 100;
          const recencyPenalty = lead.lastUsedTemplateId === template.id ? -0.2 : 0;
          const activeBoost = template.isActive ? 0.05 : 0;
          const score = winRate + (randomizer * 0.08) + recencyPenalty + activeBoost;
          return { template, index, score, winRate };
      }).sort((a, b) => b.score - a.score);

      const winner = scored[0];
      const strategy = `Sektör başarı skoru: %${Math.round(winner.winRate * 100)}`;
      return { template: winner.template, variant: winner.index, strategy };
  };

  const buildSectorMessage = (lead: Lead, variant: number) => {
      const weakness = lead.scoreDetails?.digitalWeaknesses?.[0] || lead.digitalWeakness;
      const websiteState = lead.websitesi_var_mi === 'Hayır'
          ? `${lead.ilce} bölgesinde sizi arayan kişiler karşısında güçlü bir dijital vitrin göremiyor.`
          : `Mevcut web varlığınız dönüşüm potansiyelini tam kullanmıyor.`;

      const options = [
          `${lead.sektor} tarafında ${lead.ilce} bölgesinde görünürlük son aylarda daha rekabetçi hale geldi.`,
          `${lead.ilce} çevresinde ${lead.sektor} aramalarında sizi öne çıkaracak birkaç net fırsat gördüm.`,
          `${lead.sektor} müşterileri karar vermeden önce dijitalde hızlı karşılaştırma yapıyor; burada güçlü bir fırsat var.`,
          `${lead.firma_adi} için özellikle ilk temas ve güven inşasında dijital görünümünüzü güçlendirebiliriz.`,
          websiteState,
          weakness ? `Özellikle "${weakness}" tarafında hızlı iyileştirme alanı dikkat çekiyor.` : websiteState
      ];
      return options[variant % options.length];
  };

  const buildCallToAction = (lead: Lead, variant: number) => {
      const highPriority = (lead.scoreDetails?.finalLeadScore || lead.lead_skoru || 1) >= 4;
      const persona = lead.personaAnalysis?.type;
      const personaCTA = persona === 'Analitik'
          ? `${lead.firma_adi} için mini bir fırsat özeti paylaşmamı ister misiniz?`
          : persona === 'Dominant'
            ? `İsterseniz doğrudan net aksiyon planını 10 dakikada çıkaralım.`
            : `${lead.firma_adi} için kısa bir görüşme planlayabilir miyiz?`;

      const options = [
          `Uygunsanız bu hafta 10 dakikalık kısa bir ön değerlendirme yapabiliriz.`,
          `${lead.firma_adi} için 2-3 hızlı öneri paylaşmam için kısa bir görüşme planlayabilir miyiz?`,
          `İsterseniz yarın size özel bir mini yol haritasını kısaca anlatabilirim.`,
          `Müsait olduğunuz bir saatte, kısa bir görüşmede net aksiyon adımlarını paylaşabilirim.`,
          personaCTA,
          highPriority
              ? `Bu fırsat sıcak görünüyor; bugün/yarın 10 dakikalık bir slot ayırabilir misiniz?`
              : `Uygun olduğunuzda kısa bir keşif görüşmesi yapabiliriz.`
      ];
      return options[variant % options.length];
  };

  const sanitizeColdBody = (body: string) => {
      const lines = body.split('\n');
      const cleaned = lines.filter(line => !/^\s*[-•]?\s*.*(paket|\bTL\b|₺|fiyat|ücret).*$/i.test(line.trim()));
      return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const applyTemplate = (lead: Lead, template: EmailTemplate) => {
      let subject = template.subject;
      let body = template.body;
      const variant = getDeterministicVariant(lead, 6);
      
      const replacements: Record<string, string> = {
          '{firma_adi}': lead.firma_adi,
          '{yetkili}': lead.yetkili_adi || 'Yetkili',
          '{ilce}': lead.ilce,
          '{sektor}': lead.sektor,
          '{aksiyon_cagrisi}': buildCallToAction(lead, variant),
          '{sektor_ozel_mesaj}': buildSectorMessage(lead, variant)
      };

      Object.keys(replacements).forEach(key => {
          subject = subject.replace(new RegExp(key, 'g'), replacements[key]);
          body = body.replace(new RegExp(key, 'g'), replacements[key]);
      });

      body = sanitizeColdBody(body);

      return { subject, body, templateId: template.id };
  };

  const processQueueItem = async (item: QueueItem) => {
      if (item.status === 'waiting_assets') return; 
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sending' } : q));

      try {
          let content;
          if (item.generatedContent) {
              content = { 
                  subject: item.generatedContent.subject, 
                  body: item.generatedContent.body, 
                  templateId: 'ai-generated' 
              };
          } else {
              content = applyTemplate(item.lead, item.template);
          }
          
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
          
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sent' } : q));
          loadData(); 
          
      } catch (error) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
      }
  };

  const handleAnalyzePersona = async (item: QueueItem) => {
      setAnalyzingPersonaId(item.id);
      try {
          const persona = await api.strategy.analyzePersona(item.lead);
          
          // Update Lead locally and remotely
          const updatedLead = { ...item.lead, personaAnalysis: persona };
          await api.leads.update(updatedLead);
          
          // Update queue
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, lead: updatedLead } : q));
          
          await api.dashboard.logAction('Persona Analizi', `${item.lead.firma_adi}: ${persona.type}`, 'success');
      } catch (error) {
          console.error(error);
          alert("Persona analizi yapılamadı.");
      } finally {
          setAnalyzingPersonaId(null);
      }
  };

  const handleSmartWrite = async (item: QueueItem) => {
      // Ensure we use the latest lead data from queue which might have persona
      const currentItem = queue.find(q => q.id === item.id) || item;
      
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sending' } : q));
      
      try {
          const generated = await api.templates.generateColdEmail(currentItem.lead);
          
          setQueue(prev => prev.map(q => q.id === item.id ? { 
              ...q, 
              status: 'pending', 
              generatedContent: generated,
              reason: 'AI Persona ile Yazıldı ✨'
          } : q));

          const draftLead: Lead = {
              ...currentItem.lead,
              draftResponse: {
                  subject: generated.subject,
                  body: generated.body + `\n\n${generated.cta}`,
                  intent: 'cold_outreach',
                  created_at: new Date().toISOString()
              },
              notlar: `[AI Cold Email]: ${generated.tone}, Persona: ${currentItem.lead.personaAnalysis?.type || 'Bilinmiyor'}`
          };
          
          setSelectedDraft(draftLead);
          setDraftSubject(generated.subject);
          setDraftBody(generated.body + `\n\n${generated.cta}`);
          setActiveTab('approval');

      } catch (error) {
          console.error("Smart write failed", error);
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
          alert("AI metin oluşturamadı.");
      }
  };

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
          
          const updatedLead: Lead = {
              ...selectedDraft,
              lead_durumu: 'takipte',
              draftResponse: undefined,
              son_kontakt_tarihi: new Date().toISOString().slice(0, 10)
          };
          
          await api.leads.update(updatedLead);
          await api.dashboard.logAction('Yanıt Onaylandı', `${selectedDraft.firma_adi} mail gönderildi`, 'success');
          
          setQueue(prev => prev.filter(q => q.lead.id !== selectedDraft.id));
          setSelectedDraft(null);
          loadData();
      } catch (error) {
          console.error(error);
          alert("Gönderim başarısız.");
      } finally {
          setIsSendingDraft(false);
      }
  };

  const renderPersonaBadge = (type: PersonaType) => {
      const colors = {
          'Dominant': 'bg-red-100 text-red-700 border-red-200',
          'Analitik': 'bg-blue-100 text-blue-700 border-blue-200',
          'Sosyal': 'bg-yellow-100 text-yellow-700 border-yellow-200',
          'Guven_Odakli': 'bg-green-100 text-green-700 border-green-200',
          'Bilinmiyor': 'bg-slate-100 text-slate-500'
      };
      return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${colors[type] || colors['Bilinmiyor']}`}>
              {type}
          </span>
      );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-2">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`pb-2 px-2 font-medium text-sm transition-colors ${activeTab === 'queue' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
              Otomatik Kuyruk ({queue.filter(i => i.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('approval')}
            className={`pb-2 px-2 font-medium text-sm transition-colors ${activeTab === 'approval' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
              Yanıt Onayı
          </button>
      </div>

      {activeTab === 'queue' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">Akıllı Kuyruk</h3>
                      <p className="text-sm text-slate-500">Otomatik gönderim bekleyen iletiler.</p>
                  </div>
                  <button onClick={() => calculateQueue(leads, templates)} className="p-2 bg-slate-100 rounded hover:bg-slate-200"><RefreshCw size={16}/></button>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b text-slate-500">
                          <tr>
                              <th className="px-6 py-3">Firma</th>
                              <th className="px-6 py-3">Persona</th>
                              <th className="px-6 py-3">Durum</th>
                              <th className="px-6 py-3">Aksiyon</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {queue.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-3 font-medium">
                                      <div className="text-slate-900">{item.lead.firma_adi}</div>
                                      <div className="text-xs text-slate-500">{item.lead.sektor}</div>
                                  </td>
                                  <td className="px-6 py-3">
                                      {item.lead.personaAnalysis ? (
                                          <div className="flex flex-col gap-1">
                                              {renderPersonaBadge(item.lead.personaAnalysis.type)}
                                              <span className="text-[9px] text-slate-400 truncate max-w-[100px]" title={item.lead.personaAnalysis.communicationStyle}>
                                                  {item.lead.personaAnalysis.communicationStyle}
                                              </span>
                                          </div>
                                      ) : (
                                          <button 
                                            onClick={() => handleAnalyzePersona(item)} 
                                            disabled={analyzingPersonaId === item.id}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded border border-indigo-100"
                                          >
                                              {analyzingPersonaId === item.id ? <Loader2 size={10} className="animate-spin"/> : <BrainCircuit size={10}/>}
                                              Analiz Et
                                          </button>
                                      )}
                                  </td>
                                  <td className="px-6 py-3">
                                      {item.status === 'waiting_assets' ? (
                                          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                                              <ImageIcon size={12}/> Görsel Bekliyor
                                          </span>
                                      ) : item.status === 'sending' ? (
                                          <span className="flex items-center gap-1 text-indigo-600 font-bold"><Loader2 size={12} className="animate-spin"/> İşleniyor</span>
                                      ) : item.status === 'pending' ? (
                                          <span className="text-slate-500 flex items-center gap-1"><Clock size={12}/> Sırada</span>
                                      ) : item.status === 'error' ? (
                                          <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={12}/> Hata</span>
                                      ) : (
                                          <span className="text-green-600 font-bold flex items-center gap-1"><Check size={12}/> Gönderildi</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-3 flex gap-2">
                                      {item.status === 'pending' && (
                                          <>
                                            <button onClick={() => processQueueItem(item)} className="text-slate-600 hover:text-slate-800 text-xs font-bold border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors">Şablonla</button>
                                            <button onClick={() => handleSmartWrite(item)} className="text-indigo-600 hover:text-indigo-700 text-xs font-bold border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition-colors flex items-center gap-1">
                                                <Sparkles size={12} /> Özel Yaz {item.lead.personaAnalysis ? '(Persona)' : ''}
                                            </button>
                                          </>
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
          <div className="flex h-full gap-6">
              {/* Draft List */}
              <div className="w-1/3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">Onay Bekleyenler</div>
                  <div className="flex-1 overflow-y-auto">
                      {leads.filter(l => l.draftResponse).map(lead => (
                          <div 
                            key={lead.id}
                            onClick={() => openDraft(lead)}
                            className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedDraft?.id === lead.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                          >
                              <div className="font-medium text-slate-800">{lead.firma_adi}</div>
                              <div className="text-xs text-slate-500 mt-1">{lead.draftResponse?.subject}</div>
                              
                              <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-indigo-600 font-bold uppercase">{lead.draftResponse?.intent.replace('_', ' ')}</span>
                                  {lead.personaAnalysis && renderPersonaBadge(lead.personaAnalysis.type)}
                              </div>
                          </div>
                      ))}
                      {leads.filter(l => l.draftResponse).length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-sm">Onay bekleyen taslak yok.</div>
                      )}
                  </div>
              </div>

              {/* Draft Editor */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col relative">
                  {selectedDraft ? (
                      <>
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700">Taslak Düzenleyici</span>
                                {selectedDraft.personaAnalysis && (
                                    <span className="text-xs text-slate-500">
                                        (Hedef Persona: <strong>{selectedDraft.personaAnalysis.type}</strong>)
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setSelectedDraft(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                        </div>
                        <div className="p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kime</label>
                                <div className="text-sm text-slate-800 font-mono bg-slate-100 p-2 rounded">{selectedDraft.email}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Konu</label>
                                <input 
                                    value={draftSubject}
                                    onChange={(e) => setDraftSubject(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">İçerik</label>
                                <textarea 
                                    value={draftBody}
                                    onChange={(e) => setDraftBody(e.target.value)}
                                    className="w-full flex-1 p-3 border border-slate-300 rounded text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button 
                                onClick={handleApproveSend}
                                disabled={isSendingDraft}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm disabled:opacity-70"
                            >
                                {isSendingDraft ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                {isSendingDraft ? 'Gönderiliyor...' : 'Onayla ve Gönder'}
                            </button>
                        </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <Mail size={48} className="mb-4 opacity-20" />
                          <p>Soldan bir taslak seçin.</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default MailAutomation;
