import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, Attachment, FilterKey } from './types';
import { sendMessageToGemini, fileToGenerativePart } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import { Send, Paperclip, Trash2, Settings, Hexagon, ShieldCheck, ScrollText, Command, ChevronDown, MessageSquare, Mic, MicOff, Cpu, BookOpen, AlertTriangle, Layers, CheckCircle, Filter } from 'lucide-react';

// Type definition for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: Sender.Bot,
      text: `## 1. Análise Técnica
Sistema online. Especialista Industrial pronto para operação.

## 2. Aplicação de Normas
Base de dados carregada: ABNT, ISO, ASME, AWS, DIN, ASTM.

## 3. Riscos e Inconsistências
Validação de campo necessária. ART obrigatória para execução.

## 4. Recomendações
Faça o upload de desenhos, WPS ou especifique o problema técnico.

## 5. Conclusão Objetiva
Aguardando input.`,
      timestamp: Date.now(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputMinimized, setIsInputMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Filters State
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>(['analise', 'normas', 'riscos', 'recomendacoes', 'conclusao']);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionApi = SpeechRecognition || webkitSpeechRecognition;

    if (SpeechRecognitionApi) {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputText(prev => {
            // Avoid duplicating if the previous text ends with the same string (edge case)
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + finalTranscript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        // Don't auto-stop unless explicitly requested, to allow pauses in dictation
        // However, if user stopped speaking for a long time, the browser might stop it.
        if (isListening) {
             // Optional: restart if you want "always on" behavior, but for now let's respect browser stop
             setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []); // Empty dependency array, init once

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain') {
             try {
                const attachment = await fileToGenerativePart(file);
                newAttachments.push(attachment);
             } catch (err) {
                 console.error("Failed to load file", err);
             }
        } else {
            alert("Formato não suportado.");
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;

    // Stop listening if sending
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: Sender.User,
      text: inputText,
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setIsLoading(true);

    const thinkingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
        id: thinkingId,
        sender: Sender.Bot,
        text: '',
        timestamp: Date.now(),
        isThinking: true
    }]);

    try {
      const responseText = await sendMessageToGemini(userMessage.text, userMessage.attachments);
      
      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
        ? { ...msg, isThinking: false, text: responseText }
        : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
        ? { 
            ...msg, 
            isThinking: false, 
            text: `## 1. Análise Técnica\n\n## 3. Riscos e Inconsistências\n\nErro de comunicação.\n\n## 5. Conclusão Objetiva\nVerifique a conexão.` 
          }
        : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFilter = (filter: FilterKey) => {
    setActiveFilters(prev => {
      if (prev.includes(filter)) {
        // Don't let it become empty (optional, but good for UX)
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== filter);
      }
      return [...prev, filter];
    });
  };

  const FilterButton = ({ id, label, icon: Icon, colorClass }: { id: FilterKey, label: string, icon: any, colorClass: string }) => {
    const isActive = activeFilters.includes(id);
    return (
      <button 
        onClick={() => toggleFilter(id)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border
          ${isActive 
            ? `bg-white shadow-sm ${colorClass} border-slate-200` 
            : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200'}`}
      >
        <Icon size={14} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      
      {/* Sidebar - Tech Dashboard Style */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              <Hexagon size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-none">Engenheiro.AI</h1>
              <span className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-mono">Professional</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 font-mono pl-2">Módulos do Sistema</div>
          
          <nav className="space-y-2">
            <div className="group flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded border border-slate-700/50 hover:border-blue-500/30 transition-all cursor-default">
              <Settings size={18} className="text-blue-400 group-hover:text-blue-300 transition-colors"/>
              <div>
                <div className="text-sm font-medium text-slate-200">Usinagem</div>
                <div className="text-[10px] text-slate-500 font-mono">ISO 286 • ISO 2768</div>
              </div>
            </div>

            <div className="group flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded border border-slate-700/50 hover:border-amber-500/30 transition-all cursor-default">
              <ShieldCheck size={18} className="text-amber-400 group-hover:text-amber-300 transition-colors"/>
              <div>
                <div className="text-sm font-medium text-slate-200">Soldagem</div>
                <div className="text-[10px] text-slate-500 font-mono">AWS D1.1 • ASME IX</div>
              </div>
            </div>

            <div className="group flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded border border-slate-700/50 hover:border-emerald-500/30 transition-all cursor-default">
              <ScrollText size={18} className="text-emerald-400 group-hover:text-emerald-300 transition-colors"/>
              <div>
                <div className="text-sm font-medium text-slate-200">Normas</div>
                <div className="text-[10px] text-slate-500 font-mono">DIN • ASTM • ABNT</div>
              </div>
            </div>
          </nav>

          <div className="mt-8 p-4 border border-slate-800 rounded bg-slate-950/50">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-mono text-green-500 uppercase">Sistema Online</span>
             </div>
             <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 w-2/3 opacity-50"></div>
             </div>
             <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1">
                <span>LAT: 24ms</span>
                <span>MEM: OK</span>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 text-center font-mono">
          VERSÃO 2.5.0-RC
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ 
                 backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
                 backgroundSize: '40px 40px' 
             }}>
        </div>

        {/* Header Mobile */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-10 border-b border-slate-700">
            <div className="font-bold flex items-center gap-2">
                 <Hexagon size={20} className="text-blue-500" />
                 <span className="tracking-tight">Engenheiro.AI</span>
            </div>
        </header>

        {/* FILTER HUD - NEW FEATURE */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
           <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-1 text-slate-400 mr-2 pr-2 border-r border-slate-200">
                <Filter size={14} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Filtros</span>
              </div>
              
              <FilterButton id="analise" label="Análise" icon={Cpu} colorClass="text-indigo-600 border-indigo-200" />
              <FilterButton id="normas" label="Normas" icon={BookOpen} colorClass="text-blue-600 border-blue-200" />
              <FilterButton id="riscos" label="Riscos" icon={AlertTriangle} colorClass="text-amber-600 border-amber-200" />
              <FilterButton id="recomendacoes" label="Recomendações" icon={Layers} colorClass="text-slate-700 border-slate-300" />
              <FilterButton id="conclusao" label="Conclusão" icon={CheckCircle} colorClass="text-emerald-600 border-emerald-200" />
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 scroll-smooth z-0">
          <div className="max-w-4xl mx-auto pr-0 md:pr-8">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} activeFilters={activeFilters} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Input Widget - Bottom Right */}
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-30 flex flex-col items-end space-y-2 pointer-events-auto w-[92vw] md:w-auto">
            
            {isInputMinimized ? (
                <button 
                    onClick={() => setIsInputMinimized(false)}
                    className="flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:bg-slate-800 transition-all border border-slate-700 hover:border-blue-500 group animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="relative">
                        <div className="absolute -inset-2 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-50 transition-opacity"></div>
                        <MessageSquare size={20} className="relative text-blue-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left hidden md:block">
                        <div className="text-[10px] uppercase text-slate-500 group-hover:text-slate-400 font-mono tracking-wider leading-none mb-1">Sistema</div>
                        <div className="font-bold text-sm leading-none">Nova Consulta</div>
                    </div>
                    {/* Mobile only text if needed, but icon usually sufficient */}
                    <span className="md:hidden font-bold text-sm">Abrir</span>
                </button>
            ) : (
                <div className="w-full md:w-[600px] flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                    
                    {/* Tech Header for the box */}
                     <div className="flex justify-between items-center bg-slate-900 text-white px-5 py-2.5 rounded-t-xl shadow-lg border-x border-t border-slate-800 transition-colors duration-300">
                        <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] ${isListening ? 'bg-red-500 animate-ping shadow-red-500/50' : 'bg-blue-500 animate-pulse'}`}></div>
                            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-300 font-semibold">
                              {isListening ? 'GRAVANDO ÁUDIO...' : 'PAINEL DE CONTROLE'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className={`hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${isListening ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                              <Command size={8} />
                              <span>{isListening ? 'MIC ON' : 'READY'}</span>
                           </div>
                           <button 
                               onClick={() => setIsInputMinimized(true)}
                               className="text-slate-400 hover:text-white hover:bg-slate-800 rounded p-1 transition-all"
                               title="Minimizar painel"
                           >
                               <ChevronDown size={16} />
                           </button>
                        </div>
                     </div>

                     {/* Input Box */}
                     <div className={`bg-white/90 backdrop-blur-xl border border-t-0 rounded-b-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] p-4 overflow-hidden transition-colors duration-300 ${isListening ? 'border-red-500/30 shadow-red-500/10' : 'border-slate-300'}`}>
                        
                        {/* Attachments */}
                        {attachments.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-3 px-1 mb-2 border-b border-slate-100">
                            {attachments.map((att, idx) => (
                              <div key={idx} className="relative group bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center gap-2 min-w-[140px]">
                                <div className="bg-white p-1.5 rounded border border-slate-100 shadow-sm">
                                    <Paperclip size={12} className="text-blue-500" />
                                </div>
                                <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">{att.name || 'Anexo'}</span>
                                <button 
                                    onClick={() => removeAttachment(idx)}
                                    className="absolute -top-1.5 -right-1.5 bg-white text-red-500 border border-red-100 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                >
                                    <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-3 items-end">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Adicionar contexto técnico (PDF, Imagem, Texto)"
                          >
                            <Paperclip size={20} />
                            <input 
                                type="file" 
                                multiple 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileSelect}
                                accept="image/*,.pdf,.txt"
                            />
                          </button>

                           <button 
                            onClick={toggleListening}
                            className={`p-3 rounded-xl transition-colors ${isListening ? 'text-red-600 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            title={isListening ? "Parar gravação" : "Ativar entrada de voz"}
                          >
                            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                          </button>
                          
                          <textarea 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                            placeholder={isListening ? "Ouvindo sua voz..." : "Digite sua consulta técnica ou anexe documentos..."}
                            className="flex-1 max-h-48 bg-transparent border-none resize-none focus:ring-0 py-3 text-slate-800 placeholder-slate-400 text-sm md:text-base"
                            rows={1}
                            style={{ minHeight: '48px' }}
                          />

                          <button 
                            onClick={handleSend}
                            disabled={isLoading || (!inputText && attachments.length === 0)}
                            className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center mb-1
                              ${isLoading || (!inputText && attachments.length === 0)
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-200'
                              }`}
                          >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={20} strokeWidth={2} />
                            )}
                          </button>
                        </div>
                     </div>
                </div>
            )}
        </div>

      </main>
    </div>
  );
};

export default App;