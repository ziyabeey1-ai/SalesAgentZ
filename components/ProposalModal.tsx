
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Wand2, Loader2, Check, FileText, Calculator, Download, Printer, Palette, Sparkles, Instagram, TrendingUp, ShieldAlert, Target, ArrowRight, LayoutTemplate, Briefcase, User } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Lead } from '../types';
import { api } from '../services/api';
import { SYSTEM_PROMPT } from '../constants';
import { storage } from '../services/storage';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';

interface ProposalModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProposalData {
    meta: {
        senderBrand: string; // Company Name or Full Name
        senderSub: string;   // Role or Slogan
        isAgency: boolean;
    };
    cover: {
        title: string;
        subtitle: string;
        date: string;
    };
    competitorAnalysis: {
        headers: string[];
        rows: { label: string; client: string; competitor: string; leader: string }[];
        summary: string;
    };
    opportunities: {
        title: string;
        items: { title: string; impact: 'Yüksek' | 'Orta'; description: string }[];
    };
    solution: {
        packageName: string;
        price: number;
        features: string[];
        timeline: string;
        methodology: string; // New: How we work
    };
    closing: {
        callToAction: string;
        contactName: string;
        contactPhone: string;
        strategicNote: string;
    };
}

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const ProposalModal: React.FC<ProposalModalProps> = ({ lead, isOpen, onClose, onSuccess }) => {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<'config' | 'preview'>('config');
  
  // Config State
  const [packageType, setPackageType] = useState<'Baslangic' | 'Kurumsal' | 'Ozel'>('Kurumsal');
  const [basePrice, setBasePrice] = useState<number>(0);
  
  // Generated Data State
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Refs
  const pagesRef = useRef<HTMLDivElement>(null);
  
  // Persona Info
  const userProfile = storage.getUserProfile();

  // Determine Brand Identity (Agency vs Freelancer)
  const isAgency = !!userProfile.companyName && userProfile.companyName.length > 2;
  const brandName = isAgency ? userProfile.companyName : userProfile.fullName;
  const subInfo = isAgency ? (userProfile.website || 'Dijital Çözüm Ortağınız') : (userProfile.role || 'Freelance Geliştirici');

  useEffect(() => {
    if (lead && isOpen) {
        setStep('config');
        setProposalData(null);
        calculateInitialPrice(lead.sektor);
    }
  }, [lead, isOpen]);

  const calculateInitialPrice = (sector: string) => {
      let price = 15000;
      let multiplier = 1;

      switch(sector) {
          case 'Sağlık': multiplier = 1.8; break; 
          case 'Emlak': multiplier = 1.5; break; 
          case 'Restoran': multiplier = 1.2; break; 
          case 'Güzellik': multiplier = 1.1; break; 
          default: multiplier = 1;
      }
      setBasePrice(Math.round(price * multiplier));
      setPackageType(sector === 'Sağlık' || sector === 'Emlak' ? 'Kurumsal' : 'Baslangic');
  };

  const generateProposal = async () => {
    if (!lead) return;
    setGenerating(true);

    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        
        const socialContext = lead.instagramProfile 
            ? `Instagram Verisi: ${lead.instagramProfile.username}, Tema: ${lead.instagramProfile.recentPostTheme}.`
            : `Instagram: Veri yok.`;

        const competitorContext = lead.competitorAnalysis
            ? `Rakip Analizi: ${lead.competitorAnalysis.summary}`
            : `Rakip Analizi: Genel sektör standartlarını baz al.`;

        const senderIdentity = isAgency 
            ? `Biz "${brandName}" adında bir ajansız. Kurumsal ve "BİZ" dili kullan.` 
            : `Ben "${brandName}" adında bir uzmanım (${userProfile.role}). Samimi, profesyonel ve "BEN" dili kullan.`;

        const prompt = `
            GÖREV: "${lead.firma_adi}" (${lead.sektor}, ${lead.ilce}) için 5 sayfalık, derinlemesine ve son derece profesyonel bir web tasarım strateji raporu içeriği hazırla.
            
            GÖNDEREN KİMLİĞİ: ${senderIdentity}
            FİYAT: ${basePrice} TL
            PAKET: ${packageType}
            
            BAĞLAM:
            ${socialContext}
            ${competitorContext}
            
            KURALLAR & "SESSİZ ÖĞRENME":
            1. Sektör Jargonu: Restoran ise "Masa devir hızı", Emlak ise "Lead kalitesi", Sağlık ise "Hasta güveni" gibi terimler kullan.
            2. Rakiplerin Dili: Rakipler ne vaat ediyor? (Örn: 7/24 Randevu, QR Menü).
            3. "Teklif" kelimesini az kullan, buna "Dijital Büyüme Raporu" veya "Fırsat Analizi" de.
            
            İSTENEN JSON FORMATI:
            {
                "emailSubject": "Mail Konusu (Merak uyandırıcı)",
                "emailBody": "Mail İçeriği (Kısa ve PDF'i işaret eden)",
                "data": {
                    "cover": { 
                        "title": "Dijital Varlık & Fırsat Analizi", 
                        "subtitle": "${lead.firma_adi} İçin Stratejik Yol Haritası", 
                        "date": "Bugünün Tarihi" 
                    },
                    "competitorAnalysis": {
                        "headers": ["Kriter", "Siz", "Ortalama Rakip", "Pazar Lideri"],
                        "rows": [
                            { "label": "Mobil Deneyim", "client": "Yok/Zayıf", "competitor": "Standart", "leader": "Kusursuz (App-like)" },
                            { "label": "Google Görünürlüğü", "client": "Haritada Yok", "competitor": "İlk Sayfa", "leader": "Ads + SEO" },
                            { "label": "Müşteri Etkileşimi", "client": "Sadece Telefon", "competitor": "Form", "leader": "Otomatik Randevu/Sipariş" }
                        ],
                        "summary": "Analizlerimiz, rakiplerinizin dijital kanallardan ayda ortalama 40+ yeni müşteri kazandığını gösteriyor. Siz bu pastadan pay almıyorsunuz."
                    },
                    "opportunities": {
                        "title": "Masada Bırakılan Para",
                        "items": [
                            { "title": "7/24 Randevu/Sipariş", "impact": "Yüksek", "description": "Siz uyurken bile müşterilerin işlem yapabilmesi." },
                            { "title": "Instagram Entegrasyonu", "impact": "Orta", "description": "Sosyal medyadaki güncelliği siteye taşıyarak güven artırmak." },
                            { "title": "Yerel SEO Hakimiyeti", "impact": "Yüksek", "description": "${lead.ilce} aramalarında en üstte çıkarak komşu müşteriyi kapmak." }
                        ]
                    },
                    "solution": {
                        "packageName": "${packageType} Dijital Dönüşüm Paketi",
                        "price": ${basePrice},
                        "features": ["Mobil Uyumlu Modern Arayüz", "Google Haritalar Optimizasyonu (SEO)", "Hızlı İletişim (WhatsApp) Butonu", "Admin Paneli"],
                        "timeline": "7-10 İş Günü",
                        "methodology": "Analiz > Tasarım > Kodlama > Test > Yayına Alma sürecini şeffaf bir şekilde yönetiyoruz."
                    },
                    "closing": {
                        "callToAction": "Uygulamayı Birlikte Netleştirelim",
                        "contactName": "${userProfile.fullName}",
                        "contactPhone": "${userProfile.phone || '05XX...'}",
                        "strategicNote": "Bu rapor, ${lead.ilce} bölgesindeki dijital rekabet yoğunluğu ve ${lead.sektor} sektörü dinamikleri baz alınarak özel olarak hazırlanmıştır."
                    }
                }
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || '';
        const jsonRes = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

        // Inject Meta Data for Persona Logic
        jsonRes.data.meta = {
            senderBrand: brandName,
            senderSub: subInfo,
            isAgency: isAgency
        };

        setProposalData(jsonRes.data);
        setEmailSubject(jsonRes.emailSubject);
        setEmailBody(jsonRes.emailBody);
        setStep('preview');

    } catch (error) {
        console.error("Generation failed", error);
        alert("Teklif oluşturulamadı.");
    } finally {
        setGenerating(false);
    }
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
      if (!pagesRef.current) return null;
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pages = pagesRef.current.querySelectorAll('.pdf-page');
      
      for (let i = 0; i < pages.length; i++) {
          const page = pages[i] as HTMLElement;
          
          const canvas = await html2canvas(page, {
              scale: 2, // High resolution
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = doc.internal.pageSize.getHeight();
          
          if (i > 0) doc.addPage();
          doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      return doc.output('blob');
  };

  const handleDownload = async () => {
      const blob = await generatePDFBlob();
      if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${lead?.firma_adi}_Firsat_Analizi.pdf`;
          a.click();
      }
  };

  const handleSendEmail = async () => {
      if (!lead || !proposalData) return;
      setSending(true);
      try {
          const blob = await generatePDFBlob();
          if (!blob) throw new Error("PDF Failed");

          // Convert Blob to Base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              
              await api.gmail.send(
                  lead.email, 
                  emailSubject, 
                  emailBody, 
                  [{ 
                      filename: 'Dijital_Firsat_Analizi.pdf', 
                      content: base64, 
                      mimeType: 'application/pdf' 
                  }]
              );

              // Update System
              await api.leads.update({ 
                  ...lead, 
                  lead_durumu: 'teklif_gonderildi',
                  son_kontakt_tarihi: new Date().toISOString().slice(0,10)
              });
              
              await api.tasks.create({
                  id: Math.random().toString(36).substr(2, 9),
                  firma_adi: lead.firma_adi,
                  lead_durumu: 'teklif_gonderildi',
                  gorev_tipi: 'teklif_kontrol',
                  aciklama: 'Teklif gönderildi, 3 gün sonra ara.',
                  oncelik: 'Yüksek',
                  son_tarih: new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10),
                  durum: 'açık'
              });

              onSuccess();
              onClose();
          };
      } catch (error) {
          console.error(error);
          alert("Gönderim başarısız.");
      } finally {
          setSending(false);
      }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                 <LayoutTemplate size={20} className="text-white" />
             </div>
             <div>
                <h3 className="font-bold text-lg">
                    {isAgency ? 'Kurumsal Teklif Mimarı' : 'Freelance Teklif Mimarı'}
                </h3>
                <p className="text-xs text-slate-400">
                    Gönderen: <span className="text-indigo-300 font-bold">{brandName}</span> ({lead.firma_adi} için hazırlanıyor)
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* LEFT: Config Panel */}
            <div className={`w-80 bg-slate-50 border-r border-slate-200 flex flex-col transition-all ${step === 'preview' ? 'hidden md:flex' : ''}`}>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    
                    {step === 'config' ? (
                        <>
                            {/* Persona Check */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Kimlik (Persona)</h4>
                                <div className="flex items-center gap-3">
                                    {userProfile.logo ? (
                                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                            <img src={userProfile.logo} className="w-full h-full object-cover" alt="Logo" />
                                        </div>
                                    ) : (
                                        <div className={`p-2 rounded-lg ${isAgency ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {isAgency ? <Briefcase size={20} /> : <User size={20} />}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{brandName}</p>
                                        <p className="text-[10px] text-slate-500">{subInfo}</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">
                                    *Ayarlar sayfasından bu bilgileri değiştirebilirsiniz.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paket Seçimi</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {(['Baslangic', 'Kurumsal', 'Ozel'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPackageType(p)}
                                            className={`p-3 text-sm font-medium rounded-lg border text-left flex justify-between items-center ${
                                                packageType === p 
                                                ? 'bg-white border-purple-600 text-purple-700 shadow-md ring-1 ring-purple-600' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'
                                            }`}
                                        >
                                            {p}
                                            {packageType === p && <Check size={16} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fiyat (TL)</label>
                                <div className="relative">
                                    <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="number" 
                                        value={basePrice}
                                        onChange={(e) => setBasePrice(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed">
                                <p className="font-bold mb-1 flex items-center gap-1"><Sparkles size={12}/> AI Strateji Motoru</p>
                                Yapay zeka; sizin <b>{isAgency ? 'kurumsal kimliğinizi' : 'uzman kimliğinizi'}</b> kullanarak 5 sayfalık derinlemesine bir analiz ve ikna raporu hazırlayacak.
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-green-800 text-sm">
                                <Check size={16} className="inline mb-1 mr-1"/> Rapor Başarıyla Hazırlandı!
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Mail Konusu</label>
                                <input 
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Mail İçeriği</label>
                                <textarea 
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={6}
                                    className="w-full p-2 border border-slate-300 rounded text-sm resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-200 bg-white">
                    {step === 'config' ? (
                        <button 
                            onClick={generateProposal}
                            disabled={generating}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {generating ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />}
                            {generating ? 'Raporu Hazırla' : 'Raporu Oluştur'}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <button 
                                onClick={handleSendEmail}
                                disabled={sending}
                                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"
                            >
                                {sending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                {sending ? 'Gönderiliyor...' : 'E-posta ile Gönder'}
                            </button>
                            <button 
                                onClick={handleDownload}
                                className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> PDF İndir
                            </button>
                            <button onClick={() => setStep('config')} className="text-xs text-slate-500 hover:underline w-full text-center mt-2">
                                Düzenlemeye Dön
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Preview Area (Scrollable A4 Pages) */}
            <div className="flex-1 bg-slate-200 p-8 overflow-y-auto flex flex-col items-center gap-8 shadow-inner">
                {step === 'preview' && proposalData && (
                    <div ref={pagesRef} className="space-y-8">
                        
                        {/* PAGE 1: COVER */}
                        <div className="pdf-page w-[210mm] h-[297mm] bg-slate-900 text-white shadow-xl relative overflow-hidden flex flex-col">
                            {/* Brand Header */}
                            <div className="absolute top-10 left-12 flex items-center gap-3 z-10">
                                {userProfile.logo ? (
                                    <img src={userProfile.logo} className="w-14 h-14 object-contain bg-white rounded-lg p-1" alt="Brand Logo"/>
                                ) : (
                                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl">
                                        {proposalData.meta.senderBrand.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-lg leading-none">{proposalData.meta.senderBrand}</h4>
                                    <p className="text-xs text-slate-400">{proposalData.meta.senderSub}</p>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 flex flex-col justify-center px-12 relative z-10">
                                <div className="w-24 h-1 bg-indigo-500 mb-8"></div>
                                <h1 className="text-6xl font-black leading-tight mb-4 tracking-tight">
                                    {proposalData.cover.title}
                                </h1>
                                <p className="text-2xl text-indigo-200 font-light tracking-wide max-w-xl">
                                    {proposalData.cover.subtitle}
                                </p>
                            </div>

                            {/* Client Info */}
                            <div className="px-12 pb-16 relative z-10">
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl">
                                    <h2 className="text-3xl font-bold text-white mb-2">{lead.firma_adi}</h2>
                                    <p className="text-lg text-slate-400 mb-6">{lead.ilce}, {lead.sektor}</p>
                                    <div className="flex justify-between items-end border-t border-white/10 pt-6">
                                        <div>
                                            <p className="text-xs text-indigo-400 uppercase font-bold tracking-wider mb-1">HAZIRLAYAN</p>
                                            <p className="font-medium">{userProfile.fullName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-indigo-400 uppercase font-bold tracking-wider mb-1">TARİH</p>
                                            <p className="font-medium">{new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Abstract Shapes */}
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 -mr-20 -mt-20"></div>
                            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600 rounded-full blur-[100px] opacity-20 -ml-20 -mb-20"></div>
                        </div>

                        {/* PAGE 2: COMPETITOR ANALYSIS */}
                        <div className="pdf-page w-[210mm] h-[297mm] bg-white shadow-xl p-16 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                                <Target className="text-indigo-600" size={32} /> Rekabet Aynası
                            </h3>
                            <p className="text-slate-500 mb-12 text-lg">Sektör standartlarına göre dijital performans kıyaslaması.</p>

                            <div className="flex-1">
                                <table className="w-full text-left border-collapse rounded-xl overflow-hidden shadow-sm">
                                    <thead>
                                        <tr className="bg-slate-900 text-white text-sm uppercase tracking-wider">
                                            {proposalData.competitorAnalysis.headers.map((h, i) => (
                                                <th key={i} className="p-5">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="text-lg">
                                        {proposalData.competitorAnalysis.rows.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 odd:bg-slate-50 even:bg-white">
                                                <td className="p-6 font-bold text-slate-800">{row.label}</td>
                                                <td className="p-6">
                                                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">{row.client}</span>
                                                </td>
                                                <td className="p-6 text-slate-600 text-base">{row.competitor}</td>
                                                <td className="p-6 font-medium text-green-700">{row.leader}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="mt-12 bg-indigo-50 border-l-8 border-indigo-600 p-8 rounded-r-xl">
                                    <h4 className="font-bold text-indigo-900 mb-3 text-xl">Analist Notu</h4>
                                    <p className="text-slate-700 italic text-lg leading-relaxed">"{proposalData.competitorAnalysis.summary}"</p>
                                </div>
                            </div>
                            
                            {/* Footer Watermark */}
                            <div className="absolute bottom-8 right-12 flex items-center gap-2 opacity-30">
                                <span className="font-bold text-slate-400">{proposalData.meta.senderBrand}</span>
                                <div className="w-8 h-8 bg-slate-400 rounded-full"></div>
                            </div>
                            <div className="text-right text-xs text-slate-300 mt-auto">Sayfa 2/5</div>
                        </div>

                        {/* PAGE 3: OPPORTUNITIES */}
                        <div className="pdf-page w-[210mm] h-[297mm] bg-white shadow-xl p-16 flex flex-col relative">
                            <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                                <ShieldAlert className="text-amber-500" size={32} /> Kaçırılan Fırsatlar
                            </h3>
                            <p className="text-slate-500 mb-12 text-lg">Dijital varlığınızdaki boşluklar ve potansiyel kazançlar.</p>

                            <div className="space-y-8 flex-1">
                                {proposalData.opportunities.items.map((item, i) => (
                                    <div key={i} className="flex gap-6 items-start bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm text-amber-600 flex items-center justify-center font-bold text-2xl flex-shrink-0 border border-slate-100">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-4 mb-2">
                                                <h4 className="text-2xl font-bold text-slate-800">{item.title}</h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                    item.impact === 'Yüksek' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                    {item.impact} Etki
                                                </span>
                                            </div>
                                            <p className="text-lg text-slate-600 leading-relaxed">{item.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-8 p-6 bg-slate-900 rounded-xl text-white flex items-center justify-between">
                                <div>
                                    <h5 className="font-bold text-lg">Toplam Etki Analizi</h5>
                                    <p className="text-slate-400 text-sm">Bu fırsatlar değerlendirildiğinde öngörülen büyüme.</p>
                                </div>
                                <div className="text-3xl font-black text-green-400">+%40</div>
                            </div>

                            <div className="text-right text-xs text-slate-300 mt-auto pt-8">Sayfa 3/5</div>
                        </div>

                        {/* PAGE 4: SOLUTION */}
                        <div className="pdf-page w-[210mm] h-[297mm] bg-white shadow-xl p-16 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-[80px] opacity-60 -mr-20 -mt-20"></div>
                            
                            <h3 className="text-3xl font-bold mb-2 flex items-center gap-3 relative z-10 text-slate-900">
                                <Sparkles className="text-indigo-600" size={32} /> Çözüm Mimarisi
                            </h3>
                            <p className="text-slate-500 mb-12 text-lg relative z-10">İşletmeniz için özel olarak tasarlanmış dijital çözüm.</p>

                            <div className="bg-slate-900 rounded-3xl p-10 text-white relative z-10 shadow-2xl">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h4 className="text-3xl font-bold mb-2">{proposalData.solution.packageName}</h4>
                                        <p className="text-indigo-300">Anahtar Teslim Proje</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-5xl font-bold text-white">
                                            {proposalData.solution.price.toLocaleString()} TL
                                        </p>
                                        <p className="text-sm text-slate-400 mt-1">+ KDV</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-10">
                                    {proposalData.solution.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                                <Check size={16} strokeWidth={3} className="text-white" />
                                            </div>
                                            <span className="text-lg font-medium">{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-white/10 pt-8 flex gap-12">
                                    <div>
                                        <p className="text-xs text-indigo-300 uppercase font-bold mb-1">TESLİMAT</p>
                                        <p className="text-2xl font-bold">{proposalData.solution.timeline}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-indigo-300 uppercase font-bold mb-1">METODOLOJİ</p>
                                        <p className="text-sm text-slate-300 max-w-xs">{proposalData.solution.methodology}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-12 text-center">
                                <p className="text-slate-500 italic">"Yatırımınızın karşılığını ilk 3 ayda almanız için tasarlandı."</p>
                            </div>

                            <div className="text-right text-xs text-slate-300 mt-auto">Sayfa 4/5</div>
                        </div>

                        {/* PAGE 5: CLOSING & STRATEGY */}
                        <div className="pdf-page w-[210mm] h-[297mm] bg-white shadow-xl p-16 flex flex-col justify-center text-center relative">
                            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                            
                            <h3 className="text-5xl font-black text-slate-900 mb-8 leading-tight">
                                {proposalData.closing.callToAction}
                            </h3>
                            
                            <div className="w-32 h-2 bg-indigo-500 mx-auto mb-16 rounded-full"></div>

                            <div className="bg-slate-50 p-10 rounded-3xl border border-slate-200 mb-16 text-left relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                                <h4 className="text-sm font-bold text-indigo-900 uppercase mb-4 flex items-center gap-2">
                                    <LayoutTemplate size={16} /> Stratejik Not
                                </h4>
                                <p className="text-xl text-slate-700 leading-relaxed font-light">
                                    {proposalData.closing.strategicNote}
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                {userProfile.logo ? (
                                    <div className="w-32 h-32 mb-2 p-2 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-lg">
                                        <img src={userProfile.logo} className="w-full h-full object-contain" alt="Signature Logo"/>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center text-white mb-2 shadow-xl">
                                        <span className="text-3xl font-bold">{proposalData.meta.senderBrand.charAt(0)}</span>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-3xl font-bold text-slate-900 mb-1">{proposalData.closing.contactName}</h4>
                                    <p className="text-lg text-slate-500">{proposalData.meta.senderSub}</p>
                                </div>
                                <div className="flex gap-8 mt-4">
                                    <div className="text-left">
                                        <p className="text-xs text-slate-400 uppercase font-bold">TELEFON</p>
                                        <p className="text-xl font-medium text-slate-800">{proposalData.closing.contactPhone}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-slate-400 uppercase font-bold">E-POSTA</p>
                                        <p className="text-xl font-medium text-slate-800">{userProfile.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto border-t border-slate-100 pt-8 w-full flex justify-between items-center text-sm text-slate-400">
                                <span>© {new Date().getFullYear()} {proposalData.meta.senderBrand}. Tüm hakları saklıdır.</span>
                                <span>Sayfa 5/5</span>
                            </div>
                        </div>

                    </div>
                )}
                
                {step === 'config' && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Wand2 size={64} className="mb-4 opacity-20" />
                        <p>Analiz ve strateji raporunu oluşturmak için soldaki paneli kullanın.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalModal;
