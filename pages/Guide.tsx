
import React from 'react';
import { BookOpen, Zap, Target, Mail, Activity, PlayCircle, ShieldCheck, HelpCircle, CheckCircle, Calendar } from 'lucide-react';

const Guide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* Intro */}
      <div className="text-center py-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Uygulama Kullanma Rehberi</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
              Yapay Zeka Satış Ajanı, İstanbul'daki yeni işletmeleri bulup, onlarla otonom iletişim kuran akıllı bir sistemdir.
              Bu rehber, sistemden en yüksek verimi almanız için hazırlanmıştır.
          </p>
      </div>

      {/* Quick Start */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Zap className="text-indigo-600" /> Hızlı Başlangıç (3 Adım)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-3">1</div>
                  <h4 className="font-semibold text-slate-800 mb-2">Ayarları Yapın</h4>
                  <p className="text-sm text-slate-600">Ayarlar sayfasından Google API anahtarınızı ve <strong>Persona (Kimlik)</strong> bilgilerinizi girin.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-3">2</div>
                  <h4 className="font-semibold text-slate-800 mb-2">Otopilotu Başlatın</h4>
                  <p className="text-sm text-slate-600">Sağ üstteki "Başlat" (Play) butonuna basın. Ajan arka planda çalışmaya başlar.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mb-3">3</div>
                  <h4 className="font-semibold text-slate-800 mb-2">Onaylayın</h4>
                  <p className="text-sm text-slate-600">Mail Otomasyonu &gt; Yanıt Onayı sekmesine düşen taslakları kontrol edip gönderin.</p>
              </div>
          </div>
      </div>

      {/* Core Features */}
      <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Temel Özellikler</h3>
          
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">
              <div className="p-6 md:w-1/3 bg-indigo-50 border-r border-indigo-100 flex flex-col items-center justify-center text-center">
                  <Target size={48} className="text-indigo-600 mb-3" />
                  <h4 className="font-bold text-indigo-900">Lead Bulma & Zenginleştirme</h4>
              </div>
              <div className="p-6 md:w-2/3">
                  <ul className="space-y-3 text-slate-600 text-sm">
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Otomatik Keşif:</strong> Ajan, Google Maps üzerinden sektör ve ilçe bazlı tarama yaparak yeni işletmeleri bulur.</span>
                      </li>
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Veri Zenginleştirme:</strong> Telefonu veya e-postası eksik olan firmaları Google'da aratarak eksik bilgileri tamamlar.</span>
                      </li>
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Akıllı Skorlama:</strong> Her lead için 1-5 arası bir "Potansiyel Skoru" hesaplar.</span>
                      </li>
                  </ul>
              </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">
              <div className="p-6 md:w-1/3 bg-purple-50 border-r border-purple-100 flex flex-col items-center justify-center text-center">
                  <Mail size={48} className="text-purple-600 mb-3" />
                  <h4 className="font-bold text-purple-900">Otonom Mail Süreci</h4>
              </div>
              <div className="p-6 md:w-2/3">
                  <ul className="space-y-3 text-slate-600 text-sm">
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>İlk Temas (Outreach):</strong> Yeni bulunan lead'lere, belirlenen şablonla otomatik tanışma maili atar.</span>
                      </li>
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Yanıt Yönetimi (Onaylı):</strong> Müşteriden cevap gelirse, yapay zeka bunu analiz eder ve bir cevap taslağı hazırlar. Bu taslak "Yanıt Onayı" sekmesine düşer.</span>
                      </li>
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Follow-up (Takip):</strong> Cevap vermeyenlere 3-7-12 gün arayla otomatik hatırlatma mailleri gönderir.</span>
                      </li>
                  </ul>
              </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">
              <div className="p-6 md:w-1/3 bg-teal-50 border-r border-teal-100 flex flex-col items-center justify-center text-center">
                  <Calendar size={48} className="text-teal-600 mb-3" />
                  <h4 className="font-bold text-teal-900">Akıllı Takvim</h4>
              </div>
              <div className="p-6 md:w-2/3">
                  <ul className="space-y-3 text-slate-600 text-sm">
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Randevu Botu:</strong> Müşteri "Uygunum" dediğinde, takviminizdeki boşlukları tarar ve otomatik olarak uygun saatleri önerir.</span>
                      </li>
                      <li className="flex gap-2">
                          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Google Takvim Entegrasyonu:</strong> Google hesabınızla giriş yaparsanız etkinlikleriniz gerçek zamanlı senkronize olur.</span>
                      </li>
                  </ul>
              </div>
          </div>
      </div>

      {/* FAQ / Tips */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <HelpCircle className="text-slate-600" /> Sık Sorulan Sorular & İpuçları
          </h3>
          <div className="space-y-4">
              <details className="group border border-slate-200 rounded-lg p-4 cursor-pointer open:bg-slate-50">
                  <summary className="font-semibold text-slate-800 flex justify-between items-center">
                      Persona (Kimlik) Ayarı nedir?
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-slate-600 mt-2">
                      Ayarlar &gt; Persona sekmesinden adınızı, unvanınızı ve şirket adınızı girerseniz, Yapay Zeka mail atarken ve teklif hazırlarken bu bilgileri kullanarak sizin ağzınızdan konuşur.
                  </p>
              </details>

              <details className="group border border-slate-200 rounded-lg p-4 cursor-pointer open:bg-slate-50">
                  <summary className="font-semibold text-slate-800 flex justify-between items-center">
                      Ajan neden durdu?
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-slate-600 mt-2">
                      "Maliyet Koruması" (Cost Guard) devreye girmiş olabilir. Ayarlar sayfasından günlük yapay zeka işlem limitini kontrol edin veya artırın.
                  </p>
              </details>
              
              <details className="group border border-slate-200 rounded-lg p-4 cursor-pointer open:bg-slate-50">
                  <summary className="font-semibold text-slate-800 flex justify-between items-center">
                      Sayfayı kapatırsam çalışmaya devam eder mi?
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-slate-600 mt-2">
                      Hayır. Bu bir web uygulamasıdır. Otopilotun çalışması için sekmenin açık kalması gerekir. Ancak verileriniz (LocalStorage veya Google Sheets) kalıcıdır.
                  </p>
              </details>
          </div>
      </div>

      <div className="text-center pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500">Sırada ne var?</p>
          <div className="flex justify-center gap-4 mt-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-not-allowed">
              <span className="flex items-center gap-1 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Sesli Ajan (Yakında)</span>
              <span className="flex items-center gap-1 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Instagram DM (Yakında)</span>
              <span className="flex items-center gap-1 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">CRM Entegrasyonu (Yakında)</span>
          </div>
      </div>

    </div>
  );
};

export default Guide;
