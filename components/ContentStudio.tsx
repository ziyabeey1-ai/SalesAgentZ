
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Lead } from '../types';
import { SYSTEM_PROMPT } from '../constants';
import { api } from '../services/api';
import { Wand2, Loader2, Copy, Check, LayoutTemplate, Instagram, Hash, FileText, Save, Image as ImageIcon, Download } from 'lucide-react';

interface ContentStudioProps {
  lead: Lead;
}

type ContentType = 'web_hero' | 'web_about' | 'social_plan';

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const ContentStudio: React.FC<ContentStudioProps> = ({ lead }) => {
  const [activeType, setActiveType] = useState<ContentType>('web_hero');
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Image Gen State
  const [generatingImgId, setGeneratingImgId] = useState<number | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});

  const generateContent = async () => {
    setLoading(true);
    setGeneratedContent(null);
    setGeneratedImages({});

    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        let prompt = "";
        
        if (activeType === 'web_hero') {
            prompt = `
                GÖREV: "${lead.firma_adi}" (${lead.sektor}, ${lead.ilce}) için modern bir web sitesi "Hero Section" (Giriş Bölümü) metni yaz.
                
                ÇIKTI FORMATI (JSON):
                {
                    "headline": "Vurucu, kısa ve dikkat çekici ana başlık",
                    "subheadline": "Müşteriyi harekete geçiren, fayda odaklı 2 cümlelik alt açıklama",
                    "cta_button": "Eylem çağrısı butonu metni (Örn: Randevu Al)"
                }
            `;
        } else if (activeType === 'web_about') {
            prompt = `
                GÖREV: "${lead.firma_adi}" (${lead.sektor}) için güven veren bir "Hakkımızda" yazısı hazırla.
                
                KURALLAR:
                - Samimi ama profesyonel ol.
                - İstanbul, ${lead.ilce} lokasyonunu vurgula.
                - 3 kısa paragraf olsun.
                
                ÇIKTI FORMATI (JSON):
                {
                    "title": "Başlık (Örn: Biz Kimiz?)",
                    "content": "Metin içeriği..."
                }
            `;
        } else if (activeType === 'social_plan') {
            prompt = `
                GÖREV: "${lead.firma_adi}" için 3 adet Instagram post fikri üret.
                
                ÇIKTI FORMATI (JSON Array):
                [
                    {
                        "idea": "Post fikri başlığı",
                        "visual": "Görselin detaylı tasviri (AI image generator için prompt gibi)",
                        "caption": "Post açıklaması metni (Emoji kullan)",
                        "hashtags": "#etiket1 #etiket2"
                    }
                ]
            `;
        }

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
        
        setGeneratedContent(data);

    } catch (error) {
        console.error(error);
        alert("İçerik üretilemedi.");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateImage = async (idx: number, visualPrompt: string) => {
      setGeneratingImgId(idx);
      try {
          // Enhance prompt with context
          const fullPrompt = `${visualPrompt}. Context: High quality social media post for a ${lead.sektor} business in Istanbul.`;
          const base64 = await api.visuals.generateSocialPostImage(fullPrompt);
          setGeneratedImages(prev => ({ ...prev, [idx]: base64 }));
      } catch (error) {
          console.error(error);
          alert("Görsel oluşturulamadı.");
      } finally {
          setGeneratingImgId(null);
      }
  };

  const handleCopy = (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
  };

  const saveToNotes = async () => {
      if (!generatedContent) return;
      
      const contentStr = JSON.stringify(generatedContent, null, 2);
      const note = `[STUDIO - ${activeType.toUpperCase()}]\n${contentStr}`;
      
      const updatedLead = { ...lead, notlar: lead.notlar ? `${note}\n\n${lead.notlar}` : note };
      await api.leads.update(updatedLead);
      alert("İçerik notlara kaydedildi!");
  };

  return (
    <div className="h-full flex flex-col">
        {/* Type Selector */}
        <div className="grid grid-cols-3 gap-2 mb-6">
            <button 
                onClick={() => setActiveType('web_hero')}
                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                    activeType === 'web_hero' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <LayoutTemplate size={20} />
                Web Giriş (Hero)
            </button>
            <button 
                onClick={() => setActiveType('web_about')}
                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                    activeType === 'web_about' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <FileText size={20} />
                Hakkımızda
            </button>
            <button 
                onClick={() => setActiveType('social_plan')}
                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                    activeType === 'social_plan' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <Instagram size={20} />
                Sosyal Medya
            </button>
        </div>

        {/* Action Area */}
        {!generatedContent && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Wand2 size={48} className="text-indigo-200 mb-4" />
                <h4 className="text-lg font-bold text-slate-700 mb-2">Yapay Zeka İçerik Üreticisi</h4>
                <p className="text-sm text-slate-500 mb-6 max-w-xs">
                    {activeType === 'social_plan' 
                        ? 'İşletme için 3 adet görsel fikirli Instagram post taslağı oluştur.' 
                        : 'Web sitesi için profesyonel ve ikna edici metinler yaz.'}
                </p>
                <button 
                    onClick={generateContent}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2"
                >
                    <Wand2 size={18} /> İçerik Üret
                </button>
            </div>
        )}

        {loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
                <Loader2 size={40} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-500 font-medium animate-pulse">Sektörel trendler analiz ediliyor...</p>
                <p className="text-xs text-slate-400 mt-2">En uygun ton belirleniyor</p>
            </div>
        )}

        {generatedContent && !loading && (
            <div className="flex-1 overflow-y-auto space-y-4 animate-fade-in pr-1">
                
                {/* WEB HERO DISPLAY */}
                {activeType === 'web_hero' && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Site Önizleme</span>
                            <button onClick={() => handleCopy(JSON.stringify(generatedContent), 'all')} className="text-slate-400 hover:text-indigo-600"><Copy size={14}/></button>
                        </div>
                        <div className="p-8 text-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                            <h2 className="text-2xl font-bold mb-4 leading-tight">{generatedContent.headline}</h2>
                            <p className="text-slate-300 mb-8 max-w-md mx-auto text-sm">{generatedContent.subheadline}</p>
                            <button className="px-6 py-3 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-500 transition-colors">
                                {generatedContent.cta_button}
                            </button>
                        </div>
                    </div>
                )}

                {/* WEB ABOUT DISPLAY */}
                {activeType === 'web_about' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-slate-800">{generatedContent.title}</h3>
                            <button onClick={() => handleCopy(generatedContent.content, 'about')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600">
                                {copied === 'about' ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                            </button>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                            {generatedContent.content}
                        </p>
                    </div>
                )}

                {/* SOCIAL PLAN DISPLAY */}
                {activeType === 'social_plan' && Array.isArray(generatedContent) && (
                    <div className="space-y-4">
                        {generatedContent.map((post: any, idx: number) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                                {/* Visual Area */}
                                <div className="w-full md:w-32 md:h-32 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 overflow-hidden relative group">
                                    {generatedImages[idx] ? (
                                        <>
                                            <img src={generatedImages[idx]} alt="Generated" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button 
                                                    onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = generatedImages[idx];
                                                        link.download = `social-post-${idx}.png`;
                                                        link.click();
                                                    }}
                                                    className="p-1.5 bg-white rounded-full text-slate-900 hover:bg-slate-200"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </>
                                    ) : generatingImgId === idx ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 size={24} className="text-indigo-500 animate-spin" />
                                            <span className="text-[10px] text-slate-500">Üretiliyor...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <ImageIcon className="text-slate-300" size={24} />
                                            <button 
                                                onClick={() => handleGenerateImage(idx, post.visual)}
                                                className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded hover:text-indigo-600 hover:border-indigo-200 shadow-sm"
                                            >
                                                Görsel Üret
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-slate-800 text-sm truncate">{post.idea}</h4>
                                        <button onClick={() => handleCopy(`${post.caption} ${post.hashtags}`, `post-${idx}`)} className="text-slate-400 hover:text-indigo-600">
                                            {copied === `post-${idx}` ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2 italic border-l-2 border-indigo-100 pl-2">
                                        Fikir: {post.visual}
                                    </p>
                                    <p className="text-sm text-slate-700 mb-2 line-clamp-3">
                                        {post.caption}
                                    </p>
                                    <p className="text-xs text-indigo-600 font-medium">
                                        {post.hashtags}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end">
                    <button 
                        onClick={saveToNotes}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900"
                    >
                        <Save size={16} /> Notlara Kaydet
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default ContentStudio;
