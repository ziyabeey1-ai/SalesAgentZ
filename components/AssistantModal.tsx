
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Type, LiveServerMessage, Modality } from "@google/genai";
import { X, Send, Bot, Loader2, Globe, ExternalLink, Save, CheckCircle, Calendar, BarChart3, Edit3, Mic, MicOff, Volume2, Radio, Image as ImageIcon, Instagram } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';
import { api } from '../services/api';
import { audioContext, base64ToArrayBuffer, createPCM16Blob, decodeAudioData, arrayBufferToBase64 } from '../utils/audioUtils';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
  toolCalls?: string[]; // Log of tools called
}

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const AssistantModal: React.FC<AssistantModalProps> = ({ isOpen, onClose }) => {
  // Mode State
  const [mode, setMode] = useState<'text' | 'live'>('text');
  
  // Text Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Merhaba! Ben Satış Operasyon Asistanınım. Nasıl yardımcı olayım?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  // Live Audio State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0); // For visualizer
  const liveSessionRef = useRef<Promise<any> | null>(null); // To store session object promise
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);

  // --- TOOL DEFINITIONS ---
  // (Shared between Text and Live modes)

  const toolsDef = [
      {
        functionDeclarations: [
            {
                name: 'createLead',
                description: 'Yeni bir satış potansiyeli (Lead) veritabanına kaydeder.',
                parameters: {
                type: Type.OBJECT,
                properties: {
                    firma_adi: { type: Type.STRING, description: 'Firmanın tam adı.' },
                    sektor: { type: Type.STRING, description: 'Firmanın sektörü.' },
                    ilce: { type: Type.STRING, description: 'Firmanın bulunduğu ilçe.' },
                    email: { type: Type.STRING, description: 'E-posta adresi.' },
                    telefon: { type: Type.STRING, description: 'Telefon numarası.' },
                    notlar: { type: Type.STRING, description: 'Notlar.' }
                },
                required: ['firma_adi', 'sektor', 'ilce']
                }
            },
            {
                name: 'getStats',
                description: 'Dashboard istatistiklerini getirir.',
                parameters: { type: Type.OBJECT, properties: {} }
            },
            {
                name: 'createTask',
                description: 'Takvime yeni görev ekler.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        aciklama: { type: Type.STRING },
                        tarih: { type: Type.STRING, description: 'YYYY-MM-DD formatında.' },
                        oncelik: { type: Type.STRING },
                        firma_adi: { type: Type.STRING }
                    },
                    required: ['aciklama', 'tarih']
                }
            },
            {
                name: 'updateLeadStatus',
                description: 'Lead durumunu günceller.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        firma_adi: { type: Type.STRING },
                        yeni_durum: { type: Type.STRING }
                    },
                    required: ['firma_adi', 'yeni_durum']
                }
            },
            {
                name: 'generateVisual',
                description: 'Bir firma için web sitesi görseli tasarlar.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        firma_adi: { type: Type.STRING, description: 'Firmanın tam adı.' }
                    },
                    required: ['firma_adi']
                }
            },
            {
                name: 'analyzeInstagram',
                description: 'Bir firmanın Instagram profilini analiz eder.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        firma_adi: { type: Type.STRING, description: 'Firmanın tam adı.' }
                    },
                    required: ['firma_adi']
                }
            }
        ]
      }
  ];

  // --- COMMON TOOL HANDLER ---
  const handleToolExecution = async (name: string, args: any) => {
      console.log(`Executing Tool: ${name}`, args);
      try {
        if (name === 'createLead') {
            const newLead = {
                id: Math.random().toString(36).substr(2, 9),
                firma_adi: args.firma_adi,
                sektor: args.sektor || 'Diğer',
                ilce: args.ilce || 'İstanbul',
                email: args.email || '',
                telefon: args.telefon || '',
                kaynak: 'AI Asistan' as any,
                websitesi_var_mi: 'Hayır' as any,
                lead_durumu: 'aktif' as any,
                lead_skoru: 3,
                eksik_alanlar: [],
                notlar: args.notlar || 'AI tarafından eklendi.',
                son_kontakt_tarihi: new Date().toISOString().slice(0,10)
            };
            await api.leads.create(newLead);
            return { result: `Başarılı: ${args.firma_adi} listeye eklendi.` };
        } 
        else if (name === 'getStats') {
            const stats = await api.dashboard.getStats();
            return { result: stats };
        }
        else if (name === 'createTask') {
            const newTask = {
                id: Math.random().toString(36).substr(2, 9),
                firma_adi: args.firma_adi || 'Genel Görev',
                lead_durumu: 'takipte' as any,
                gorev_tipi: 'follow_up' as any,
                aciklama: args.aciklama,
                oncelik: (args.oncelik || 'Orta') as any,
                son_tarih: args.tarih,
                durum: 'açık' as any
            };
            await api.tasks.create(newTask);
            return { result: `Başarılı: Görev eklendi (${args.tarih}).` };
        }
        else if (name === 'updateLeadStatus') {
            const leads = await api.leads.getAll();
            const targetLead = leads.find(l => l.firma_adi.toLowerCase().includes(args.firma_adi.toLowerCase()));
            if (targetLead) {
                const updatedLead = { ...targetLead, lead_durumu: args.yeni_durum };
                await api.leads.update(updatedLead);
                return { result: `Başarılı: ${targetLead.firma_adi} durumu güncellendi.` };
            } else {
                return { result: `Hata: Firma bulunamadı.` };
            }
        }
        else if (name === 'generateVisual') {
            const leads = await api.leads.getAll();
            const targetLead = leads.find(l => l.firma_adi.toLowerCase().includes(args.firma_adi.toLowerCase()));
            
            if (!targetLead) return { result: `Hata: ${args.firma_adi} listemizde bulunamadı. Önce lead olarak ekleyin.` };
            
            // Trigger Visual Generation
            try {
                const imageBase64 = await api.visuals.generateHeroImage(targetLead);
                const updatedLead = { ...targetLead, generatedHeroImage: imageBase64 };
                await api.leads.update(updatedLead);
                await api.dashboard.logAction('Ajan: Görsel Üretim', targetLead.firma_adi, 'success');
                return { result: `Başarılı: ${targetLead.firma_adi} için görsel tasarım üretildi ve dosyasına kaydedildi.` };
            } catch(e) {
                return { result: `Hata: Görsel üretimi başarısız oldu.` };
            }
        }
        else if (name === 'analyzeInstagram') {
            const leads = await api.leads.getAll();
            const targetLead = leads.find(l => l.firma_adi.toLowerCase().includes(args.firma_adi.toLowerCase()));
            
            if (!targetLead) return { result: `Hata: ${args.firma_adi} listemizde bulunamadı.` };

            try {
                const analysis = await api.social.analyzeInstagram(targetLead);
                const updatedLead = { ...targetLead, instagramProfile: analysis };
                await api.leads.update(updatedLead);
                return { result: `Başarılı: Profil bulundu (@${analysis.username}). Önerilen DM: "${analysis.suggestedDmOpener}"` };
            } catch (e) {
                return { result: `Hata: Analiz başarısız.` };
            }
        }
      } catch (e: any) {
          return { error: e.message };
      }
      return { result: 'Unknown tool' };
  };

  // --- TEXT CHAT LOGIC ---

  useEffect(() => {
    if (isOpen && messagesEndRef.current && mode === 'text') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, mode]);

  // Clean up on unmount
  useEffect(() => {
      return () => {
          stopVoiceSession();
      };
  }, []);

  const initTextChat = () => {
    if (!chatSessionRef.current) {
        const apiKey = getApiKey();
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            chatSessionRef.current = ai.chats.create({
                model: 'gemini-3-flash-preview',
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    tools: toolsDef,
                },
            });
        }
    }
  };

  const handleTextSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;

    initTextChat();
    const userMsg: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      if (chatSessionRef.current) {
        let result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
        
        // Handle Tools (Loop for multiple calls)
        let functionCalls = result.functionCalls;
        while (functionCalls && functionCalls.length > 0) {
             const functionResponseParts: any[] = [];
             const executedToolNames: string[] = [];

             for (const call of functionCalls) {
                 const response = await handleToolExecution(call.name, call.args);
                 executedToolNames.push(call.name);
                 functionResponseParts.push({
                    functionResponse: {
                        name: call.name,
                        response: response,
                        id: call.id
                    }
                 });
             }

             // Send results back
             result = await chatSessionRef.current.sendMessage(functionResponseParts);
             
             // Check if model wants to call more tools or answer
             functionCalls = result.functionCalls;

             // If final answer
             if (result.text) {
                 setMessages(prev => [...prev, { role: 'model', text: result.text, toolCalls: executedToolNames }]);
             }
        }

        // Simple text response (if no tools or after tools)
        if (!result.functionCalls && result.text) {
             // Extract sources
             const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
             const sources = groundingChunks?.filter((c:any) => c.web?.uri && c.web?.title).map((c:any) => ({ title: c.web.title, uri: c.web.uri }));
             setMessages(prev => [...prev, { role: 'model', text: result.text, sources }]);
        }
      }
    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Hata oluştu.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LIVE AUDIO LOGIC ---

  const startLiveSession = async () => {
      try {
          const apiKey = getApiKey();
          const ai = new GoogleGenAI({ apiKey });
          
          // 1. Connect
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-12-2025',
              config: {
                  systemInstruction: SYSTEM_PROMPT + " Kullanıcı ile sesli konuşuyorsun. Kısa ve net cevaplar ver.",
                  responseModalities: [Modality.AUDIO],
                  tools: toolsDef,
              },
              callbacks: {
                  onopen: () => {
                      console.log("Live Session Connected");
                      setIsLiveConnected(true);
                      startMicrophone(sessionPromise);
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      // Handle Audio Output
                      if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                          const base64Audio = msg.serverContent.modelTurn.parts[0].inlineData.data;
                          const buffer = await decodeAudioData(base64ToArrayBuffer(base64Audio));
                          playAudioQueue(buffer);
                      }

                      // Handle Tool Calls
                      if (msg.toolCall) {
                          console.log("Live Tool Call", msg.toolCall);
                          for (const fc of msg.toolCall.functionCalls) {
                              const response = await handleToolExecution(fc.name, fc.args);
                              // Send response back
                              sessionPromise.then(session => {
                                  session.sendToolResponse({
                                      functionResponses: {
                                          id: fc.id,
                                          name: fc.name,
                                          response: response
                                      }
                                  });
                              });
                          }
                      }
                  },
                  onclose: () => {
                      console.log("Live Session Closed");
                      setIsLiveConnected(false);
                      stopMicrophone();
                  },
                  onerror: (err) => {
                      console.error("Live Error", err);
                      setIsLiveConnected(false);
                  }
              }
          });
          
          liveSessionRef.current = sessionPromise;

      } catch (error) {
          console.error("Failed to start live session", error);
      }
  };

  const startMicrophone = async (sessionPromise: Promise<any>) => {
      try {
          audioInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: {
              channelCount: 1,
              sampleRate: 16000
          }});
          
          sourceRef.current = audioInputContextRef.current.createMediaStreamSource(stream);
          processorRef.current = audioInputContextRef.current.createScriptProcessor(4096, 1, 1);
          
          processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Visualizer update
              let sum = 0;
              for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolumeLevel(Math.sqrt(sum / inputData.length));

              // Convert to PCM16 and Base64
              const pcmBlob = createPCM16Blob(inputData);
              const reader = new FileReader();
              reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  sessionPromise.then(session => {
                      session.sendRealtimeInput({
                          media: {
                              mimeType: 'audio/pcm;rate=16000',
                              data: base64
                          }
                      });
                  });
              };
              reader.readAsDataURL(pcmBlob);
          };

          sourceRef.current.connect(processorRef.current);
          processorRef.current.connect(audioInputContextRef.current.destination);
          setIsMicOn(true);

      } catch (e) {
          console.error("Mic Error", e);
      }
  };

  const stopVoiceSession = async () => {
      stopMicrophone();
      setIsLiveConnected(false);
      
      if (liveSessionRef.current) {
          try {
              const session = await liveSessionRef.current;
              session.close();
          } catch (e) {
              console.warn("Session close failed", e);
          }
          liveSessionRef.current = null;
      }
  };

  const stopMicrophone = () => {
      if (sourceRef.current) sourceRef.current.disconnect();
      if (processorRef.current) processorRef.current.disconnect();
      if (audioInputContextRef.current) audioInputContextRef.current.close();
      setIsMicOn(false);
      setVolumeLevel(0);
  };

  const playAudioQueue = (buffer: AudioBuffer) => {
      // Simple queue logic to play chunks smoothly
      const context = audioContext;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      
      const currentTime = context.currentTime;
      if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
      }
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
  };

  const handleClose = () => {
      stopVoiceSession();
      onClose();
  };

  // Toggle Mode
  const toggleMode = () => {
      if (mode === 'text') {
          setMode('live');
          startLiveSession();
      } else {
          stopVoiceSession();
          setMode('text');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-center pointer-events-none">
      <div 
        className="pointer-events-auto w-full sm:w-[500px] h-[600px] sm:h-[700px] bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-200 sm:mr-6 sm:mb-6 overflow-hidden"
        style={{ boxShadow: '0 0 50px rgba(0,0,0,0.15)' }}
      >
        {/* Header */}
        <div className={`text-white p-4 flex items-center justify-between transition-colors ${mode === 'live' ? 'bg-rose-600' : 'bg-slate-900'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${mode === 'live' ? 'bg-rose-500' : 'bg-indigo-500'}`}>
              {mode === 'live' ? <Volume2 size={20} className="animate-pulse" /> : <Bot size={20} />}
            </div>
            <div>
              <h3 className="font-semibold">{mode === 'live' ? 'Canlı Operatör' : 'AI Asistan'}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/80 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${isLiveConnected || mode === 'text' ? 'bg-green-400' : 'bg-slate-400'} ${isLiveConnected ? 'animate-pulse' : ''}`}></span>
                    {mode === 'live' ? (isLiveConnected ? 'Bağlı (Canlı)' : 'Bağlanıyor...') : 'Online'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <button 
                onClick={toggleMode}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                    mode === 'text' 
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white' 
                    : 'bg-white text-rose-600 border-white hover:bg-rose-50'
                }`}
              >
                  {mode === 'text' ? 'Canlıya Geç' : 'Yazışmaya Dön'}
              </button>
              <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
                <X size={24} />
              </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-50 relative flex flex-col">
            
            {mode === 'text' ? (
                /* TEXT CHAT VIEW */
                <>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-bl-none'
                            }`}>
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-slate-100">
                                        {msg.toolCalls.map((toolName, tIdx) => (
                                            <span key={tIdx} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                                {toolName.includes('Visual') && <ImageIcon size={10} />}
                                                {toolName.includes('Instagram') && <Instagram size={10} />}
                                                {toolName.includes('Rapor') && <BarChart3 size={10} />}
                                                {toolName.includes('Görev') && <Calendar size={10} />}
                                                {toolName}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {msg.text}
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-2 ml-1 max-w-[85%] flex flex-wrap gap-2">
                                    {msg.sources.slice(0, 3).map((source, i) => (
                                        <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 text-xs px-2 py-1 rounded hover:text-indigo-600">
                                            <span className="truncate max-w-[150px]">{source.title}</span> <ExternalLink size={10} />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin text-indigo-600" />
                                <span className="text-sm text-slate-500">Yazıyor...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                {/* Text Input */}
                <div className="p-4 bg-white border-t border-slate-200">
                    <div className="flex gap-2">
                        <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                        placeholder="Bir şeyler yaz..."
                        className="flex-1 bg-slate-100 border-0 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button onClick={() => handleTextSend()} disabled={isLoading || !inputText.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
                </>
            ) : (
                /* LIVE VOICE VIEW */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-50 to-rose-50">
                     
                     {/* Visualizer Circle */}
                     <div className="relative mb-12">
                         <div 
                            className="w-48 h-48 rounded-full bg-gradient-to-tr from-rose-400 to-orange-400 blur-2xl opacity-30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                            style={{ transform: `translate(-50%, -50%) scale(${1 + volumeLevel * 5})` }}
                         ></div>
                         
                         <div className="w-40 h-40 rounded-full bg-white shadow-xl flex items-center justify-center relative z-10 border border-rose-100">
                             {isLiveConnected ? (
                                 <div className="flex items-center justify-center gap-1 h-12">
                                     {/* Fake Audio Wave */}
                                     {[1,2,3,4,5].map(i => (
                                         <div 
                                            key={i} 
                                            className="w-2 bg-rose-500 rounded-full animate-wave" 
                                            style={{ 
                                                height: `${20 + Math.random() * 30 + volumeLevel * 100}px`,
                                                animationDuration: `${0.5 + Math.random() * 0.5}s`
                                            }} 
                                         />
                                     ))}
                                 </div>
                             ) : (
                                 <Loader2 size={48} className="text-rose-300 animate-spin" />
                             )}
                         </div>
                     </div>

                     <div className="text-center space-y-3 max-w-sm">
                         <h3 className="text-2xl font-bold text-slate-800">
                             {isLiveConnected ? "Dinliyorum..." : "Bağlanıyor..."}
                         </h3>
                         <p className="text-slate-500">
                             Şu an Gemini 2.5 Live modeli ile bağlısınız. Konuşarak rapor isteyebilir, lead ekleyebilir veya görsel üretebilirsiniz.
                         </p>
                     </div>

                     {/* Hint Chips */}
                     <div className="mt-12 flex flex-wrap justify-center gap-2">
                         <span className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-full text-xs font-medium shadow-sm">
                             "Bugünkü raporu oku"
                         </span>
                         <span className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-full text-xs font-medium shadow-sm">
                             "Kadıköy Burger için görsel hazırla"
                         </span>
                         <span className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-full text-xs font-medium shadow-sm">
                             "Ahmet Bey'e mail at"
                         </span>
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AssistantModal;
