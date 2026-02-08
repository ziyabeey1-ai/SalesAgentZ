import React, { useState } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle, Pause, Play, RefreshCw, User, ChevronRight, MapPin, CalendarClock, Send } from 'lucide-react';
import { MOCK_LEADS, MOCK_INTERACTIONS } from '../services/mockService';
import { Lead } from '../types';

// Helper to find last interaction
const getLastInteraction = (leadId: string) => {
  const interactions = MOCK_INTERACTIONS
    .filter(i => i.leadId === leadId && i.direction === 'outbound' && i.type === 'email')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return interactions.length > 0 ? interactions[0] : null;
};

// Email Template Logic
const generateEmailContent = (lead: Lead, templateType: 'intro' | 'followup1' | 'followup2') => {
  const isHighScore = lead.lead_skoru >= 4;
  const lastInteraction = getLastInteraction(lead.id);
  const district = lead.ilce || 'İstanbul';
  
  let subject = '';
  let body = '';
  let reasoning: string[] = [];

  if (templateType === 'intro') {
    reasoning.push(`Sektör: ${lead.sektor}`);
    reasoning.push(`Lokasyon: ${district} vurgusu`);
    
    switch (lead.sektor) {
      case 'Sağlık':
        subject = `[${lead.firma_adi}] için hasta güveni ve online randevu`;
        body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\n${district} bölgesinde yeni açılan klinikler için, hastaların güvenini kazanan ve **randevu sürecini otomatize eden** web siteleri kuruyorum.\n\nAraştırmalarıma göre ${district} bölgesindeki hastaların %80'i randevu almadan önce Google'da "doktor yorumları" ve "klinik fotoğrafları" aratıyor.\n\nSizin için hazırlayacağım yapı ile:\n\n*   **Online Randevu:** Telefon trafiğini azaltın.\n*   **Doktor Tanıtımı:** Uzmanlığınızı öne çıkarın.\n*   **Konum:** ${district} aramalarında öne çıkın.\n\nSize özel bir taslak hazırladım. Görmek ister misiniz?`;
        break;
      case 'Restoran':
        subject = `[${lead.firma_adi}] için QR menü ve Google'da öne çıkma`;
        body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\n${district} semtindeki rekabette, müşterilerinizin acıktığında menünüze saniyeler içinde ulaşması kritik önem taşıyor.\n\nRestoranınız için kurguladığım sistem:\n\n*   **QR Menü:** Masada ve Instagram'da kullanılabilir.\n*   **Hızlı Rezervasyon:** Tek tıkla masa ayırtma.\n*   **Google Maps:** ${district} yemek aramalarında görünürlük.\n\nLezzetlerinizi dijitalde nasıl sunabileceğimize dair 1-2 örnek paylaşabilir miyim?`;
        break;
      case 'Emlak':
        subject = `[${lead.firma_adi}] portföyünü kurumsal web sitenizde sergileyin`;
        body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\nİlan sitelerine bağımlı kalmadan, ${district} bölgesindeki portföyünüzü kendi kurumsal sitenizde sergilemek ister misiniz?\n\nKendi alan adınızla (.com) kuracağımız site sayesinde:\n\n*   **Prestij:** Müşterilerinize kurumsal bir link gönderin.\n*   **Komisyonsuz:** Kendi vitrininizi yönetin.\n*   **WhatsApp:** İlan detayından size direkt mesaj atsınlar.\n\nDemo sunumu için kısa bir görüşme yapalım mı?`;
        break;
      case 'Güzellik':
        subject = `[${lead.firma_adi}] randevularını 7/24 otomatik doldurun`;
        body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\n${district} bölgesindeki yoğunluğunuzda telefonlara yetişmek zor olabiliyor. Randevuları kaçırmamanız için size özel bir sistem geliştirdim.\n\nSizin için hazırlayacağım web sitesi ile:\n\n*   **7/24 Randevu:** Siz işlem yaparken müşteriniz randevu alsın.\n*   **Instagram Entegrasyonu:** Paylaşımlarınız direkt sitede görünsün.\n*   **Hizmet Kataloğu:** Fiyatlarınızı ve işlemlerinizi şıkça sunun.\n\n${district} bölgesindeki rakiplerinizden ayrışmak için size özel taslağı incelemek ister misiniz?`;
        break;
      default:
        subject = `[${lead.firma_adi}] dijital varlığı hakkında`;
        body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\nİstanbul'da yeni açılan işletmelere, müşteri kazandıran modern web siteleri kuruyorum.\n\nİşletmenizin ${district} bölgesindeki aramalarda öne çıkması ve güven vermesi için size özel bir çalışmam var.\n\nUygunsa 10 dakikalık kısa bir görüşme ile detayları aktarmak isterim.`;
        break;
    }
  } else if (templateType === 'followup1') {
    const timeRef = lastInteraction ? `${lastInteraction.date} tarihinde` : 'geçenlerde';
    if (lastInteraction) reasoning.push('Geçmiş Referanslı');

    if (isHighScore) {
      reasoning.push('Skor Yüksek: Doğrudan & Aciliyet');
      subject = `Hızlı aksiyon: [${lead.firma_adi}] ve dijital süreç`;
      body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\n${timeRef} gönderdiğim e-postanın üzerinden geçmek istedim.\n\n${lead.sektor} sektörü şu an hareketli ve web sitenizi bu hafta planlarsak önümüzdeki hafta yayına alabiliriz.\n\nSüreci uzatmak istemiyorum; işletmeniz için hazırladığım taslağı 10 dakikalık bir görüşmede sunabilirim.\n\nYarın 11:00 veya 14:00 size uyar mı?`;
    } else {
      reasoning.push('Skor Düşük: Fayda & Bilgi');
      subject = `[${lead.firma_adi}] için faydalı bir kaynak`;
      body = `Merhaba ${lead.yetkili_adi || 'Yetkili'},\n\n${timeRef} web sitesi hakkında yazmıştım ancak henüz dönüş alamadım. Yoğun olduğunuzu tahmin ediyorum.\n\nKarar vermeden önce incelemeniz için, ${lead.sektor} işletmelerinin web sitesi ile nasıl %30 daha fazla müşteri kazandığını anlatan kısa bir not hazırladım.\n\nBütçe ayırmadan önce sadece fikir edinmek isterseniz yanıtlamanız yeterli, iletmekten memnuniyet duyarım.`;
    }
  } else if (templateType === 'followup2') {
     if (isHighScore) {
        reasoning.push('Skor Yüksek: Netlik & Kapanış');
        subject = `Son kontrol: [${lead.firma_adi}] proje durumu`;
        body = `Merhaba,\n\nDoğru kişiyle mi iletişimdeyim emin olmak istedim.\n\n${lead.sektor} projeniz için takvimimde yer ayırmıştım ancak geri dönüş alamadım. Şu an bu konu önceliğiniz değilse dosyayı kapatıyorum.\n\nEğer ilgileniyorsanız lütfen bugün kısa bir dönüş yapın.\n\nSaygılarımla.`;
     } else {
        reasoning.push('Skor Düşük: Nezaket & Açık Kapı');
        subject = `[${lead.firma_adi}] dijitalleşme süreci hakkında`;
        body = `Merhaba,\n\nSizi tekrar tekrar rahatsız etmek istemem.\n\n${lead.sektor} sektöründeki dijital varlığınızla ilgili şu an bir adım atmayı düşünmüyorsanız sorun değil.\n\nİleride ihtiyacınız olursa portfolyomu ve referanslarımı inceleyebileceğiniz linki buraya bırakıyorum.\n\nİyi çalışmalar dilerim.`;
     }
  }
  return { subject, body, reasoning };
};

const MailAutomation: React.FC = () => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(MOCK_LEADS[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState<'intro' | 'followup1' | 'followup2'>('intro');
  const [isRunning, setIsRunning] = useState(true);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  
  // Queue State
  const [queue, setQueue] = useState([
    { id: 1, firm: 'Kadıköy Burger', template: 'Follow-up 1 (Düşük Skor)', time: 'Bugün, 14:15', status: 'pending' },
    { id: 2, firm: 'Zen Yoga', template: 'Follow-up 2 (Yüksek Skor)', time: 'Bugün, 14:30', status: 'pending' },
    { id: 3, firm: 'Dr. Ahmet Klinik', template: 'İlk Tanışma (Sağlık)', time: 'Bugün, 14:45', status: 'pending' },
  ]);

  const selectedLead = MOCK_LEADS.find(l => l.id === selectedLeadId) || MOCK_LEADS[0];
  const emailContent = generateEmailContent(selectedLead, selectedTemplate);
  const lastInteraction = getLastInteraction(selectedLead.id);

  const handleRemoveFromQueue = (id: number) => {
    setQueue(queue.filter(item => item.id !== id));
  };

  const handleTestSend = () => {
    setSendFeedback('Gönderiliyor...');
    setTimeout(() => {
        setSendFeedback('✓ Test Maili Gönderildi');
        setTimeout(() => setSendFeedback(null), 3000);
    }, 800);
  };

  return (
    <div className="space-y-8">
      {/* Control Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Otomasyon Durumu</h2>
            <p className="text-sm text-slate-500">Outreach kuyruğu ve gönderim durumu</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              {isRunning && (
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className={`text-sm font-medium ${isRunning ? 'text-green-600' : 'text-red-600'}`}>
              {isRunning ? 'Çalışıyor' : 'Durduruldu'}
            </span>
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`ml-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isRunning 
                  ? 'bg-red-50 hover:bg-red-100 text-red-700' 
                  : 'bg-green-50 hover:bg-green-100 text-green-700'
              }`}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} />} 
              {isRunning ? 'Durdur' : 'Başlat'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-4 border rounded-lg transition-colors ${isRunning ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Clock className={isRunning ? 'text-indigo-600' : 'text-slate-400'} size={20} />
              <h3 className={`font-semibold ${isRunning ? 'text-indigo-900' : 'text-slate-600'}`}>Kuyrukta</h3>
            </div>
            <p className={`text-2xl font-bold ${isRunning ? 'text-indigo-700' : 'text-slate-700'}`}>{queue.length}</p>
            <p className={`text-xs mt-1 ${isRunning ? 'text-indigo-600' : 'text-slate-500'}`}>{isRunning ? 'Sonraki gönderim: 14:00' : 'Gönderim duraklatıldı'}</p>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="text-emerald-600" size={20} />
              <h3 className="font-semibold text-emerald-900">Bugün Gönderilen</h3>
            </div>
            <p className="text-2xl font-bold text-emerald-700">38</p>
            <p className="text-xs text-emerald-600 mt-1">Başarı oranı %98</p>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="text-red-600" size={20} />
              <h3 className="font-semibold text-red-900">Hatalı / Bounce</h3>
            </div>
            <p className="text-2xl font-bold text-red-700">2</p>
            <p className="text-xs text-red-600 mt-1">Kontrol gerekiyor</p>
          </div>
        </div>
      </div>

       {/* Personalization Simulator */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-full">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw size={20} className="text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Kişiselleştirme Simülatörü</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Farklı lead profillerine göre yapay zekanın mail içeriğini nasıl değiştirdiğini test edin.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Test Lead Seçimi</label>
                  <div className="space-y-2">
                    {MOCK_LEADS.slice(0, 4).map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                          selectedLeadId === lead.id 
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            selectedLeadId === lead.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {lead.firma_adi.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-slate-900">{lead.firma_adi}</div>
                            <div className="text-xs text-slate-500">{lead.sektor} • {lead.ilce}</div>
                          </div>
                        </div>
                        {selectedLeadId === lead.id && <ChevronRight size={16} className="text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Şablon Tipi</label>
                   <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => setSelectedTemplate('intro')}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                          selectedTemplate === 'intro' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        İlk Tanışma
                      </button>
                      <button 
                         onClick={() => setSelectedTemplate('followup1')}
                         className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                          selectedTemplate === 'followup1' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Takip 1
                      </button>
                      <button 
                         onClick={() => setSelectedTemplate('followup2')}
                         className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                          selectedTemplate === 'followup2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Takip 2
                      </button>
                   </div>
                </div>
              </div>
              
              {/* Context Info Box */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Seçili Bağlam</h4>
                  <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400"/>
                          <span>Bölge: <b>{selectedLead.ilce}</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                          <CalendarClock size={14} className="text-slate-400"/>
                          <span>Son Etkileşim: <b>{lastInteraction ? lastInteraction.date : 'Yok'}</b></span>
                      </div>
                  </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
               <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User size={16} />
                    <span>Alıcı: <span className="font-medium text-slate-900">{selectedLead.yetkili_adi || 'Yetkili'}</span> ({selectedLead.email || 'email@yok.com'})</span>
                  </div>
                  <div className="flex gap-2">
                    {emailContent.reasoning.map((reason, idx) => (
                      <span key={idx} className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200">
                        {reason}
                      </span>
                    ))}
                  </div>
               </div>
               
               <div className="p-8 flex-1">
                  <div className="mb-6 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Konu</div>
                    <div className="text-lg font-medium text-slate-900 border-b border-slate-100 pb-2">
                      {emailContent.subject}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">İçerik</div>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-mono bg-slate-50 p-6 rounded-lg border border-slate-100">
                      {emailContent.body}
                    </div>
                  </div>
               </div>

               <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                  <span className={`text-sm font-medium transition-all ${sendFeedback ? 'opacity-100 text-green-600' : 'opacity-0'}`}>
                      {sendFeedback}
                  </span>
                  <button className="px-4 py-2 text-sm text-slate-600 font-medium hover:text-slate-900">Düzenle</button>
                  <button 
                    onClick={handleTestSend}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                  >
                    <Send size={16} />
                    Örnek Gönder
                  </button>
               </div>
            </div>
          </div>
       </div>

      {/* Queue Table */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Gönderim Kuyruğu</h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Firma</th>
                <th className="px-6 py-3 font-medium">Şablon</th>
                <th className="px-6 py-3 font-medium">Planlanan Zaman</th>
                <th className="px-6 py-3 font-medium">Durum</th>
                <th className="px-6 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.length > 0 ? queue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{item.firm}</td>
                  <td className="px-6 py-3 text-slate-600">{item.template}</td>
                  <td className="px-6 py-3 text-slate-600">{item.time}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                       !isRunning ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {!isRunning ? 'Duraklatıldı' : 'Bekliyor'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button 
                        onClick={() => handleRemoveFromQueue(item.id)}
                        className="text-red-600 hover:underline"
                    >
                        İptal
                    </button>
                  </td>
                </tr>
              )) : (
                  <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">Kuyrukta bekleyen mail yok.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MailAutomation;