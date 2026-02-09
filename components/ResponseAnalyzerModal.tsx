
import React, { useState } from 'react';
import { X, MessageSquare, BrainCircuit, Check, Copy, AlertTriangle, ArrowRight, Save, Loader2, Calendar, Video, Mail } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Lead, InteractionAnalysis, LeadStatus } from '../types';
import { SYSTEM_PROMPT } from '../constants';
import { api } from '../services/api';

interface ResponseAnalyzerModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (lead: Lead) => void;
}

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const ResponseAnalyzerModal: React.FC<ResponseAnalyzerModalProps> = ({ lead, isOpen, onClose, onAnalysisComplete }) => {
  const [incomingText, setIncomingText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<InteractionAnalysis | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Calendar Smart Bot State
  const [isCheckingCalendar, setIsCheckingCalendar] = useState(false);
  const [meetLink, setMeetLink] = useState('');
  const [meetingDetails, setMeetingDetails] = useState<{date: string, time: string} | null>(null);

  const handleAnalyze = async () => {
    if (!incomingText.trim()) return;
    setIsAnalyzing(true);

    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
            GÖREV: Bir potansiyel müşteriden gelen yanıtı analiz et ve satış danışmanına rehberlik et.
            
            BAĞLAM:
            Firma: ${lead.firma_adi} (${lead.sektor})
            Durum: ${lead.lead_durumu}
            Müşteri Mesajı: "${incomingText}"
            
            İSTENEN ÇIKTI (JSON):
            {
                "sentiment": "positive" | "neutral" | "negative",
                "intent": "price_inquiry" | "meeting_request" | "objection" | "not_interested" | "info_request" | "other",
                "suggested_status": "Lead Durumu (aktif, takipte, teklif_gonderildi, olumlu, olumsuz)",
                "suggested_reply": "Müşteriyi ikna edecek veya süreci ilerletecek profesyonel, kısa bir cevap taslağı."
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || '';
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);
        setAnalysis(data);

    } catch (error) {
        console.error("Analysis failed", error);
        alert("Analiz sırasında bir hata oluştu.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSmartSchedule = async () => {
      setIsCheckingCalendar(true);
      try {
          // 1. Get Calendar Events
          const events = await api.calendar.getAll();
          
          // 2. Logic to find gaps for "Tomorrow" or Next Available Day
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          let targetDate = tomorrow;
          let attempts = 0;
          let availableSlots: string[] = [];
          
          // Check next 3 days for a non-blocked day
          while (attempts < 3 && availableSlots.length === 0) {
              const dateStr = targetDate.toISOString().slice(0, 10);
              
              // Check if day is BLOCKED
              const isDayBlocked = events.some(e => e.start.startsWith(dateStr) && e.type === 'blocked');
              
              if (!isDayBlocked) {
                  // Standard slots
                  const potentialSlots = ['10:00', '11:00', '14:00', '15:00', '16:00'];
                  const dayEvents = events.filter(e => e.start.startsWith(dateStr) && e.type !== 'blocked');
                  
                  potentialSlots.forEach(slot => {
                      // Simple overlap check
                      const isBusy = dayEvents.some(e => e.start.includes(slot));
                      if (!isBusy) {
                          availableSlots.push(`${dateStr} ${slot}`);
                      }
                  });
              }
              
              if (availableSlots.length === 0) {
                  targetDate.setDate(targetDate.getDate() + 1); // Move to next day
                  attempts++;
              }
          }

          // Fallback if full
          if (availableSlots.length === 0) availableSlots.push('Haftaya uygun bir zaman');

          // Store first slot for auto-create context
          let selectedSlot = { date: '', time: '' };
          if (availableSlots[0].includes(' ')) {
              const [d, t] = availableSlots[0].split(' ');
              selectedSlot = { date: d, time: t };
              setMeetingDetails(selectedSlot);
          }

          // 3. GENERATE REAL GOOGLE MEET LINK (Context Aware)
          let realMeetLink = "Link oluşturulamadı (Google Girişi Yapın)";
          
          if (selectedSlot.date) {
              try {
                  // Determine Subject based on Intent
                  let meetingSubject = "Online Görüşme";
                  if (analysis?.intent === 'price_inquiry') meetingSubject = "Fiyatlandırma ve Paketler Görüşmesi";
                  else if (analysis?.intent === 'info_request') meetingSubject = "Hizmet Detayları Sunumu";
                  else if (analysis?.intent === 'objection') meetingSubject = "İhtiyaç Analizi ve Çözüm Görüşmesi";
                  
                  const eventTitle = `${lead.firma_adi} - ${meetingSubject}`;
                  const eventDescription = `Müşteri Mesajı: "${incomingText}"\n\nLead Durumu: ${lead.lead_durumu}\n\nBu toplantı AI Asistan tarafından otomatik planlanmıştır.`;

                  const createdLink = await api.calendar.create({
                      title: eventTitle,
                      start: `${selectedSlot.date}T${selectedSlot.time}:00`,
                      end: `${selectedSlot.date}T${parseInt(selectedSlot.time.split(':')[0]) + 1}:00:00`,
                      description: eventDescription,
                      location: 'Google Meet',
                      attendees: lead.email ? [lead.email] : [],
                      type: 'meeting'
                  });
                  
                  if (createdLink) {
                      realMeetLink = createdLink;
                      setMeetLink(realMeetLink);
                  }
              } catch (e) {
                  console.warn("Could not create real calendar event, using placeholder.", e);
                  realMeetLink = "https://meet.google.com/ (Bağlantı hatası)";
              }
          }

          // 4. Generate Reply with Slots via AI to make it natural
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `
            GÖREV: Müşteriye ONLINE TOPLANTI (Google Meet) randevusu vermek için takvimimdeki boşlukları kullan.
            
            BOŞLUKLAR: ${availableSlots.join(', ')}
            GERÇEK MEET LINKI: ${realMeetLink}
            
            MÜŞTERİ: "${incomingText}"
            
            CEVAP: Samimi, profesyonel, Türkçe. Linki ekle ve seçenek sun. "Link üzerinden toplantıya katılabilirsiniz" de.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
          });

          const draft = response.text || `Harika! Google Meet üzerinden görüşebiliriz.\n\nBağlantı: ${realMeetLink}\n\nUygun saatlerim:\n- ${availableSlots.join('\n- ')}\n\nSize hangisi uyar?`;
          
          if (analysis) {
              setAnalysis({ ...analysis, suggested_reply: draft });
          }

      } catch (e) {
          console.error(e);
      } finally {
          setIsCheckingCalendar(false);
      }
  };

  const handleCreateMeetingAndSend = async () => {
      // NOTE: With the new flow, the event is ALREADY created in handleSmartSchedule to get the link.
      
      if (!lead.email) {
          alert("Müşteri emaili eksik.");
          return;
      }
      setIsSaving(true);
      try {
          // 1. Send Email
          if (analysis?.suggested_reply) {
              await api.gmail.send(lead.email, `Randevu Daveti: ${lead.firma_adi}`, analysis.suggested_reply);
          }

          // 2. Log
          await api.leads.logInteraction(lead.id, 'email', 'Online Toplantı Daveti Gönderildi');
          await api.dashboard.logAction('Toplantı Planlandı', `${lead.firma_adi} (Link Gönderildi)`, 'success');

          onAnalysisComplete(lead);
          onClose();
          alert("Davet gönderildi! Toplantı takviminize işlendi.");

      } catch (e) {
          console.error(e);
          alert("İşlem sırasında hata oluştu.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleSave = async () => {
      if (!analysis) return;
      setIsSaving(true);

      try {
          // 1. Log Interaction (Inbound)
          await api.leads.logInteraction(lead.id, 'email', `[Gelen Yanıt] ${incomingText.substring(0, 50)}...`, {
              ...analysis,
              suggested_reply: analysis.suggested_reply // Save suggestion too
          });

          // 2. Update Lead Status (if changed)
          if (analysis.suggested_status !== lead.lead_durumu) {
              const updatedLead = { ...lead, lead_durumu: analysis.suggested_status as LeadStatus };
              await api.leads.update(updatedLead);
              onAnalysisComplete(updatedLead);
          } else {
              onAnalysisComplete(lead);
          }

          // 3. Log Action
          await api.dashboard.logAction('Yanıt Analiz Edildi', `${lead.firma_adi}: ${analysis.intent}`, 'info');

          onClose();
      } catch (e) {
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg">
                 <BrainCircuit size={20} className="text-white" />
             </div>
             <div>
                <h3 className="font-semibold text-lg">Akıllı Yanıt Analizi</h3>
                <p className="text-xs text-slate-300">Müşteri yanıtını yapıştır, yapay zeka yorumlasın.</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            
            {!analysis ? (
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">Müşteriden gelen mesajı buraya yapıştırın:</label>
                    <textarea 
                        className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 text-sm resize-none shadow-sm"
                        placeholder="Örn: Merhaba, fiyatlarınız hakkında bilgi alabilir miyim? Bütçemiz kısıtlı..."
                        value={incomingText}
                        onChange={(e) => setIncomingText(e.target.value)}
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !incomingText.trim()}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                            {isAnalyzing ? 'Analiz Ediliyor...' : 'Analiz Et'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Analysis Result Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-xl border ${
                            analysis.sentiment === 'positive' ? 'bg-green-50 border-green-200 text-green-800' :
                            analysis.sentiment === 'negative' ? 'bg-red-50 border-red-200 text-red-800' :
                            'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                            <span className="text-xs font-bold uppercase opacity-70 block mb-1">Duygu Durumu</span>
                            <span className="font-semibold capitalize flex items-center gap-2">
                                {analysis.sentiment === 'positive' ? <Check size={16}/> : analysis.sentiment === 'negative' ? <AlertTriangle size={16}/> : null}
                                {analysis.sentiment === 'positive' ? 'Olumlu' : analysis.sentiment === 'negative' ? 'Olumsuz' : 'Nötr'}
                            </span>
                        </div>
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                             <span className="text-xs font-bold uppercase opacity-70 block mb-1">Niyet (Intent)</span>
                             <span className="font-semibold capitalize">
                                 {analysis.intent.replace('_', ' ')}
                             </span>
                        </div>
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                             <span className="text-xs font-bold uppercase opacity-70 block mb-1">Önerilen Statü</span>
                             <div className="flex items-center gap-2 font-semibold">
                                 <span>{lead.lead_durumu}</span>
                                 <ArrowRight size={14} />
                                 <span>{analysis.suggested_status}</span>
                             </div>
                        </div>
                    </div>

                    {/* Suggested Reply */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
                        {analysis.intent === 'meeting_request' && !meetLink && (
                            <div className="absolute top-4 right-4 z-10">
                                <button 
                                    onClick={handleSmartSchedule}
                                    disabled={isCheckingCalendar}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors"
                                >
                                    {isCheckingCalendar ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                                    Takvimden Boşluk Bul
                                </button>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <MessageSquare size={16} className="text-indigo-600"/> Önerilen Yanıt Taslağı
                            </h4>
                            <button 
                                onClick={() => navigator.clipboard.writeText(analysis.suggested_reply)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium mr-36" // Margin for button space
                            >
                                <Copy size={12} /> Kopyala
                            </button>
                        </div>
                        <textarea 
                            value={analysis.suggested_reply}
                            onChange={(e) => setAnalysis({...analysis, suggested_reply: e.target.value})}
                            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-500 resize-none font-mono leading-relaxed"
                        />
                        {meetLink && (
                            <div className="mt-3 flex items-center gap-2 text-xs bg-green-50 p-2 rounded border border-green-200 text-green-700">
                                <Video size={14} /> Toplantı Linki Oluşturuldu: <a href={meetLink} target="_blank" rel="noreferrer" className="underline font-bold">{meetLink}</a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        {analysis && (
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center">
                <button 
                    onClick={() => { setAnalysis(null); setIncomingText(''); setMeetLink(''); setMeetingDetails(null); }}
                    className="text-sm text-slate-500 hover:text-slate-800 underline"
                >
                    Yeni Analiz
                </button>
                
                {meetLink ? (
                    <button 
                        onClick={handleCreateMeetingAndSend}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 animate-pulse"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                        {isSaving ? 'Gönderiliyor...' : 'Davet Linkini Gönder'}
                    </button>
                ) : (
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isSaving ? 'Kaydediliyor...' : 'Kaydet ve Güncelle'}
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default ResponseAnalyzerModal;
    