
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, Modality, LiveServerMessage } from "@google/genai";
import { GraduationCap, MessageSquare, Send, RefreshCw, Trophy, Star, AlertCircle, Play, User, Bot, CheckCircle, ArrowLeft, Flame, Mic, MicOff, Volume2, PhoneOff, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import Confetti from '../components/Confetti';
import { audioContext, createPCM16Blob, base64ToArrayBuffer, decodeAudioData, playAudioBuffer } from '../utils/audioUtils';

interface Scenario {
    id: string;
    title: string;
    description: string;
    difficulty: 'Kolay' | 'Orta' | 'Zor';
    persona: string;
    initialMessage: string;
    voiceName: string; // Voice personality
}

const SCENARIOS: Scenario[] = [
    {
        id: 'budget',
        title: 'Bütçe İtirazı',
        description: 'Müşteri hizmeti beğeniyor ama fiyatı çok yüksek buluyor.',
        difficulty: 'Kolay',
        persona: 'Küçük bir kafe sahibi. Harcamalara çok dikkat ediyor. "Para yok" demekten çekinmiyor. Nazik ama cimri.',
        initialMessage: "Merhaba, teklifinizi inceledim. Fikir güzel ama dürüst olacağım, bu fiyat bizim bütçemizi çok aşıyor.",
        voiceName: 'Kore'
    },
    {
        id: 'competitor',
        title: 'Rakip Memnuniyeti',
        description: 'Müşteri hali hazırda başka bir ajansla/freelancer ile çalışıyor.',
        difficulty: 'Orta',
        persona: 'Emlak ofisi sahibi. Yeğeni veya ucuz bir freelancer ile çalışıyor. Değişimden korkuyor ve biraz defansif.',
        initialMessage: "Selamlar. Bizim zaten bir web sitemiz var, yeğenim ilgileniyor. Şu an bir sorunumuz yok, neden değiştirelim ki?",
        voiceName: 'Fenrir'
    },
    {
        id: 'skeptic',
        title: 'Dijital Şüpheci',
        description: 'Müşteri web sitesinin işe yarayacağına inanmıyor.',
        difficulty: 'Zor',
        persona: 'Geleneksel bir esnaf (Tesisatçı). Teknolojiye güvenmiyor, eski usul çalışıyor. Sert ve sabırsız konuşuyor.',
        initialMessage: "Bakın, ben 20 yıldır bu mahalledeyim. Beni bilen bilir. Google'a falan ihtiyacım yok benim. Boş işler bunlar.",
        voiceName: 'Puck'
    }
];

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// Helper to get API Key
const getApiKey = () => process.env.API_KEY || localStorage.getItem('apiKey') || '';

const Training: React.FC = () => {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'feedback'>('menu');
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    
    // Voice State
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState<ChatMessage[]>([]); // For storing voice-to-text
    
    // Refs
    const chatSessionRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const liveSessionRef = useRef<Promise<any> | null>(null);
    const audioInputContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopVoiceSession();
        };
    }, []);

    const startGame = async (scenario: Scenario, selectedMode: 'text' | 'voice') => {
        setSelectedScenario(scenario);
        setMode(selectedMode);
        setGameState('playing');
        setMessages([]); 
        setLiveTranscript([]); // Reset voice transcript
        
        if (selectedMode === 'text') {
            startTextSession(scenario);
        } else {
            startVoiceSession(scenario);
        }
    };

    // --- TEXT MODE LOGIC ---
    const startTextSession = (scenario: Scenario) => {
        setMessages([{ role: 'model', text: scenario.initialMessage }]);
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        chatSessionRef.current = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: `
                    SENARYO: Sen bir işletme sahibisin.
                    KİŞİLİK (PERSONA): ${scenario.persona}
                    DURUM: Bir satış danışmanı (kullanıcı) sana web sitesi satmaya çalışıyor.
                    GÖREVİN: Persona'na uygun şekilde itiraz et, zorluk çıkar ama mantıklı argüman gelirse yavaşça ikna ol.
                    ASLA rolden çıkma. Kısa ve konuşma dilinde cevaplar ver.
                `,
            }
        });
    };

    const handleTextSend = async () => {
        if (!input.trim() || !chatSessionRef.current) return;
        
        const userMsg: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await chatSessionRef.current.sendMessage({ message: userMsg.text });
            if (response.text) {
                setMessages(prev => [...prev, { role: 'model', text: response.text }]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- VOICE MODE LOGIC ---
    const startVoiceSession = async (scenario: Scenario) => {
        try {
            const apiKey = getApiKey();
            const ai = new GoogleGenAI({ apiKey });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    systemInstruction: `
                        SENARYO: ${scenario.title}
                        ROLÜN: ${scenario.persona}
                        GÖREV: Ben bir satış danışmanıyım, sen zor bir müşterisin. Seni ikna etmeye çalışacağım.
                        KURALLAR:
                        1. Asla rolden çıkma.
                        2. İlk başta itiraz et, hemen kabul etme.
                        3. Kısa cümlelerle, doğal bir şekilde konuş.
                        4. Türkçe konuş.
                        ÖNEMLİ: Bağlantı kurulur kurulmaz konuşmaya başla ve "${scenario.initialMessage}" benzeri bir itiraz ile açılış yap.
                    `,
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: scenario.voiceName } }
                    },
                    inputAudioTranscription: {}, // Enable Input Transcription
                    // Output transcription is currently implicit/via tools, but here we only need input mainly. 
                    // However, we can track model output by assuming conversation flow or if API supports it later.
                    // For now, we rely on input transcription to know what user said.
                },
                callbacks: {
                    onopen: () => {
                        console.log("Training Session Connected");
                        setIsLiveConnected(true);
                        startMicrophone(sessionPromise);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        // 1. Audio Output
                        if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                            const base64Audio = msg.serverContent.modelTurn.parts[0].inlineData.data;
                            const buffer = await decodeAudioData(base64ToArrayBuffer(base64Audio));
                            playAudioBuffer(buffer);
                            // Simulate visualizer for AI voice
                            setVolumeLevel(0.8); 
                            setTimeout(() => setVolumeLevel(0), buffer.duration * 1000);
                        }

                        // 2. Input Transcription (User Speech)
                        if (msg.serverContent?.inputTranscription) {
                            const text = msg.serverContent.inputTranscription.text;
                            if (text) {
                                setLiveTranscript(prev => {
                                    // Append to last user message if incomplete, or new
                                    // Simple approach: Just log new chunks
                                    // Better approach: Wait for turnComplete but streaming is cooler UI.
                                    // For simplicity in analysis, we just append to list.
                                    return [...prev, { role: 'user', text }];
                                });
                            }
                        }
                        
                        // 3. Turn Complete (Model thought finished, likely spoke something)
                        // Ideally we get model text here, but currently Live API sends audio mainly.
                        // We will infer model text for evaluation as "Model Spoke".
                        if (msg.serverContent?.turnComplete) {
                             setLiveTranscript(prev => [...prev, { role: 'model', text: '(AI Sözlü Yanıt Verdi)' }]);
                        }
                    },
                    onclose: () => {
                        console.log("Session Closed");
                        setIsLiveConnected(false);
                        stopMicrophone();
                    },
                    onerror: (e) => {
                        console.error(e);
                        alert("Bağlantı hatası.");
                        setIsLiveConnected(false);
                    }
                }
            });
            liveSessionRef.current = sessionPromise;

        } catch (error) {
            console.error("Voice init failed", error);
            alert("Sesli simülasyon başlatılamadı.");
        }
    };

    const startMicrophone = async (sessionPromise: Promise<any>) => {
        try {
            audioInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
            
            sourceRef.current = audioInputContextRef.current.createMediaStreamSource(stream);
            processorRef.current = audioInputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Visualizer
                let sum = 0;
                for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                setVolumeLevel(rms); // Update UI

                // Send Data
                const pcmBlob = createPCM16Blob(inputData);
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({
                            media: { mimeType: 'audio/pcm;rate=16000', data: base64 }
                        });
                    });
                };
                reader.readAsDataURL(pcmBlob);
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioInputContextRef.current.destination);
            setIsMicOn(true);

        } catch (e) {
            console.error("Mic error", e);
        }
    };

    const stopVoiceSession = async () => {
        stopMicrophone();
        setIsLiveConnected(false);
        // Explicitly close the session to avoid lingering connections
        if (liveSessionRef.current) {
            try {
                const session = await liveSessionRef.current;
                session.close();
            } catch (e) {
                console.warn("Session close warning:", e);
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

    // --- EVALUATION ---
    const finishSession = async () => {
        if (!selectedScenario) return;
        setLoading(true);
        stopVoiceSession(); // Ensure voice is off

        try {
            let transcript = "";
            if (mode === 'text') {
                transcript = messages.map(m => `${m.role === 'user' ? 'Satıcı' : 'Müşteri'}: ${m.text}`).join('\n');
            } else {
                // Use the real-time transcript captured during voice session
                // Filter out empty texts and join
                const cleanTranscript = liveTranscript.filter(m => m.text).map(m => `${m.role === 'user' ? 'Satıcı' : 'Müşteri'}: ${m.text}`).join('\n');
                
                transcript = cleanTranscript.length > 20 
                    ? cleanTranscript 
                    : "(Sesli Görüşme Gerçekleşti - Transkript yetersiz, lütfen genel değerlendirme yap.)";
            }

            const evalResult = await api.training.evaluateSession(transcript, selectedScenario.description);
            setResult(evalResult);
            setGameState('feedback');
        } catch (e) {
            console.error(e);
            alert("Değerlendirme alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] animate-fade-in flex flex-col">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <GraduationCap className="text-indigo-600" /> Satış Eğitim Simülatörü
                    </h2>
                    <p className="text-slate-500 text-sm">Zorlu müşterilerle sanal ortamda pratik yapın.</p>
                </div>
                {gameState !== 'menu' && (
                    <button 
                        onClick={() => { setGameState('menu'); stopVoiceSession(); }}
                        className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                        <ArrowLeft size={16} /> Menüye Dön
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col relative">
                
                {/* MENU STATE */}
                {gameState === 'menu' && (
                    <div className="p-8 overflow-y-auto">
                        <h3 className="text-lg font-semibold text-slate-800 mb-6">Bir Senaryo Seçin</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {SCENARIOS.map(sc => (
                                <div key={sc.id} className="border border-slate-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col h-full relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`p-3 rounded-lg ${
                                            sc.difficulty === 'Kolay' ? 'bg-green-100 text-green-600' :
                                            sc.difficulty === 'Orta' ? 'bg-amber-100 text-amber-600' :
                                            'bg-red-100 text-red-600'
                                        }`}>
                                            {sc.difficulty === 'Kolay' ? <CheckCircle size={24} /> : sc.difficulty === 'Orta' ? <AlertCircle size={24} /> : <Flame size={24} />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sc.difficulty}</span>
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 mb-2 relative z-10">{sc.title}</h4>
                                    <p className="text-sm text-slate-600 flex-1 relative z-10">{sc.description}</p>
                                    
                                    <div className="mt-6 grid grid-cols-2 gap-3 relative z-10">
                                        <button 
                                            onClick={() => startGame(sc, 'text')}
                                            className="py-2 bg-slate-50 text-slate-600 font-medium rounded-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm"
                                        >
                                            <MessageSquare size={16} /> Yazış
                                        </button>
                                        <button 
                                            onClick={() => startGame(sc, 'voice')}
                                            className="py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-200"
                                        >
                                            <Mic size={16} /> Konuş
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PLAYING STATE */}
                {gameState === 'playing' && selectedScenario && (
                    <>
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${mode === 'voice' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {mode === 'voice' ? <Mic size={20} /> : <MessageSquare size={20} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{selectedScenario.title}</h4>
                                    <p className="text-xs text-slate-500">Müşteri: {selectedScenario.persona}</p>
                                </div>
                            </div>
                            <button 
                                onClick={finishSession}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center gap-2"
                            >
                                <PhoneOff size={14} /> Görüşmeyi Bitir
                            </button>
                        </div>
                        
                        {mode === 'text' ? (
                            // TEXT INTERFACE
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-rose-500 text-white'
                                            }`}>
                                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                            </div>
                                            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                                                msg.role === 'user' 
                                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                                            }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0"><Bot size={16}/></div>
                                            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="p-4 bg-white border-t border-slate-200">
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                                            placeholder="Cevabınızı yazın..."
                                            className="flex-1 bg-slate-100 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            disabled={loading}
                                        />
                                        <button 
                                            onClick={handleTextSend} 
                                            disabled={loading || !input.trim()}
                                            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            // VOICE INTERFACE
                            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
                                <div className="text-center mb-12">
                                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Canlı Simülasyon</h3>
                                    <p className="text-slate-500">Müşteriyi dinle ve ikna et.</p>
                                </div>

                                {/* Avatar & Visualizer */}
                                <div className="relative mb-12">
                                    {/* Pulse Effect */}
                                    <div 
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl transition-all duration-75"
                                        style={{ transform: `translate(-50%, -50%) scale(${1 + volumeLevel * 8})` }}
                                    ></div>

                                    <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white relative z-10">
                                        {isLiveConnected ? (
                                            <div className="flex gap-1 items-center h-16">
                                                {[1,2,3,4,5].map(i => (
                                                    <div 
                                                        key={i} 
                                                        className="w-3 bg-indigo-600 rounded-full animate-wave"
                                                        style={{ 
                                                            height: `${20 + volumeLevel * 150 * Math.random()}px`,
                                                            animationDuration: `${0.3 + Math.random() * 0.2}s`
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <Loader2 size={48} className="text-indigo-300 animate-spin" />
                                        )}
                                    </div>
                                    
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-1 rounded-full shadow-sm border border-slate-100 text-xs font-bold text-slate-600 whitespace-nowrap">
                                        {selectedScenario.persona.split('.')[0]}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                                        isMicOn ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                        {isMicOn ? <Mic size={18} className="animate-pulse"/> : <MicOff size={18}/>}
                                        <span className="text-sm font-medium">{isMicOn ? 'Mikrofon Açık' : 'Mikrofon Kapalı'}</span>
                                    </div>
                                </div>
                                
                                {liveTranscript.length > 0 && (
                                    <div className="absolute bottom-8 left-8 right-8 max-h-32 overflow-y-auto bg-white/80 p-3 rounded-xl text-xs text-slate-500 text-center backdrop-blur-sm shadow-sm border border-white">
                                        <p className="font-bold mb-1">Anlık Transkript (Gizli)</p>
                                        {liveTranscript.slice(-3).map((m, i) => (
                                            <p key={i} className="truncate">{m.role === 'user' ? 'Sen: ' : 'Müşteri: '} {m.text}</p>
                                        ))}
                                    </div>
                                )}
                                
                                <p className="mt-8 text-xs text-slate-400">Gemini 2.5 Live ile güçlendirilmiştir</p>
                            </div>
                        )}
                    </>
                )}

                {/* FEEDBACK STATE */}
                {gameState === 'feedback' && result && (
                    <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center p-8 animate-fade-in overflow-y-auto">
                        {result.score >= 70 && <Confetti />}
                        
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold mb-6 border-8 ${
                            result.score >= 80 ? 'border-green-100 text-green-600 bg-green-50' :
                            result.score >= 50 ? 'border-amber-100 text-amber-600 bg-amber-50' :
                            'border-red-100 text-red-600 bg-red-50'
                        }`}>
                            {result.score}
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 mb-2">
                            {result.score >= 80 ? 'Mükemmel İş! 🏆' : result.score >= 50 ? 'Güzel Çaba 👍' : 'Biraz Daha Pratik Lazım 💪'}
                        </h3>
                        <p className="text-slate-500 mb-8 max-w-md text-center">{result.feedback}</p>

                        <div className="w-full max-w-lg bg-indigo-50 rounded-xl p-6 mb-8">
                            <h4 className="text-sm font-bold text-indigo-900 uppercase mb-4 flex items-center gap-2">
                                <Star size={16} /> Gelişim İpuçları
                            </h4>
                            <ul className="space-y-2">
                                {result.tips.map((tip: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                                        <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setGameState('menu')}
                                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
                            >
                                Başka Senaryo Seç
                            </button>
                            <button 
                                onClick={() => startGame(selectedScenario!, mode)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2"
                            >
                                <RefreshCw size={18} /> Tekrar Dene
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Training;
