import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AssistantModal: React.FC<AssistantModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Merhaba! Ben İstanbul Satış Ajanı asistanınım. Bugün sana nasıl yardımcı olabilirim? Sıcak lead listesini mi görmek istersin, yoksa mail gönderimini mi başlatayım?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use a ref for the chat session to persist it across renders but not cause re-renders
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    // Initialize chat session only once when component mounts or key changes (simplified here)
    if (!chatSessionRef.current) {
        const apiKey = process.env.API_KEY || 'dummy-key-for-ui-demo'; // In a real app, this comes from env
        const ai = new GoogleGenAI({ apiKey });
        
        chatSessionRef.current = ai.chats.create({
            model: 'gemini-2.5-flash-latest', // Using a fast model for chat
            config: {
                systemInstruction: SYSTEM_PROMPT,
            },
        });
    }
  }, []);


  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;

    const userMsg: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      if (!process.env.API_KEY) {
        // Mock response if no API key is set for demo purposes
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                role: 'model', 
                text: 'API Anahtarı ayarlanmamış. Demo modunda çalışıyorum. Normalde Gemini API ile cevap verirdim.' 
            }]);
            setIsLoading(false);
        }, 1000);
        return;
      }

      if (chatSessionRef.current) {
        const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
        const text = result.text;
        if (text) {
             setMessages(prev => [...prev, { role: 'model', text }]);
        }
      }
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-center pointer-events-none">
      <div 
        className="pointer-events-auto w-full sm:w-[450px] h-[600px] sm:h-[600px] bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl flex flex-col border border-slate-200 sm:mr-6 sm:mb-6"
        style={{ boxShadow: '0 0 50px rgba(0,0,0,0.15)' }}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-500 rounded-lg">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold">AI Asistan</h3>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Çevrimiçi
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
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

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Asistana bir soru sor..."
              className="flex-1 bg-slate-100 border-0 rounded-xl px-4 py-3 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button 
              onClick={() => handleSend('Sıcak lead listesini getir')} 
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            >
              🔥 Sıcak Leadler
            </button>
            <button 
              onClick={() => handleSend('Bugünkü performans raporu')} 
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            >
              📊 Rapor
            </button>
             <button 
              onClick={() => handleSend('Takip edilmesi gerekenler')} 
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            >
              📅 Takipler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantModal;