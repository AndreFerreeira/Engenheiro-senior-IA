import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, Attachment, FilterKey } from './types';
import { sendMessageToGemini, fileToGenerativePart, GeminiLiveClient, GenerationOptions } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import VisualPanel from './components/VisualPanel';
import { Send, Paperclip, Settings, Hexagon, ScrollText, BookOpen, AlertTriangle, CheckCircle, Filter, Ruler, X, Mic, MicOff, Cpu, Layers, Globe, Brain, Radio, Phone } from 'lucide-react';

interface VisualData {
  svg: string | null;
  table: string | null;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: Sender.Bot,
      text: `## 1. Interpretação Normativa
Sistema Especialista em Engenharia (Mecânica, Materiais, Soldagem) ativo.
Normas carregadas: ABNT, ISO, ASME, AWS.

## 2. Avaliação Técnica
Modelo configurado para produzir tabelas dimensionais detalhadas (LADO A) baseadas em normas e wermac.org, em conjunto com análise (LADO B).
- Use **Thinking Mode** para problemas complexos.
- Use **Google Search** para dados atualizados.
- Use **Live Audio** para conversar em tempo real.

## 3. Riscos e Pontos Críticos
Atenção: Este sistema é uma ferramenta de apoio. A validação de campo e ART são indispensáveis.

## 4. Recomendações
Selecione uma ferramenta abaixo ou digite sua consulta.

## 5. Conclusão Profissional
Pronto para operação.`,
      timestamp: Date.now(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputMinimized, setIsInputMinimized] = useState(false);
  
  // Advanced Modes
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Live API Client Ref
  const liveClientRef = useRef<GeminiLiveClient | null>(null);

  // Visual Panel State
  const [visualData, setVisualData] = useState<VisualData>({ svg: null, table: null });
  
  // Sizing Modal State
  const [showSizingModal, setShowSizingModal] = useState(false);
  const [sizingData, setSizingData] = useState({
    type: '',
    standard: '',
    size: '',
    pressure: ''
  });
  
  // Filters State
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>(['analise', 'normas', 'riscos', 'recomendacoes', 'conclusao']);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- LIVE API HANDLERS ---
  const toggleLiveMode = async () => {
    if (isLiveActive) {
      // Stop Live Mode
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        liveClientRef.current = null;
      }
      setIsLiveActive(false);
    } else {
      // Start Live Mode
      try {
        const client = new GeminiLiveClient(
          (transcript) => {
             // Optional: You can display live transcriptions here or in a subtitle overlay
             console.log("Live Transcript:", transcript);
          },
          () => setIsLiveActive(false)
        );
        await client.connect();
        liveClientRef.current = client;
        setIsLiveActive(true);
      } catch (e) {
        console.error("Failed to start live session", e);
        alert("Erro ao iniciar áudio ao vivo. Verifique permissões de microfone.");
        setIsLiveActive(false);
      }
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

  // Robust parser using strict delimiters defined in Gemini Service
  const parseResponse = (fullText: string): { cleanedText: string, visuals: VisualData } => {
    let svg = null;
    let table = null;
    let cleanedText = fullText;

    const visualStartTag = "[[[VISUAL_PANEL_START]]]";
    const visualEndTag = "[[[VISUAL_PANEL_END]]]";
    const textStartTag = "[[[TEXT_ANALYSIS_START]]]";
    const textEndTag = "[[[TEXT_ANALYSIS_END]]]";

    // 1. Extract Visual Panel
    const vStartIndex = fullText.indexOf(visualStartTag);
    const vEndIndex = fullText.indexOf(visualEndTag);

    if (vStartIndex !== -1 && vEndIndex !== -1) {
      const visualBlock = fullText.substring(vStartIndex + visualStartTag.length, vEndIndex);
      
      // Check for SVG block
      const svgMatch = visualBlock.match(/```svg\s*([\s\S]*?)\s*```/i);
      if (svgMatch && svgMatch[1].includes('<svg')) {
        svg = svgMatch[1].trim();
      }

      // Extract Table from Visual Block
      // Look for a Markdown table structure (rows with |)
      const tableMatch = visualBlock.match(/(\|[^\n]+\|\r?\n)((?:\|[^\n]+\|\r?\n)+)/);
      if (tableMatch) {
        table = tableMatch[0].trim();
      } else {
         // Fallback lazy match for table
         const rawTable = visualBlock.match(/\|[\s\S]*\|/);
         if (rawTable) table = rawTable[0].trim();
      }
    }

    // 2. Extract Text Analysis
    const tStartIndex = fullText.indexOf(textStartTag);
    const tEndIndex = fullText.indexOf(textEndTag);

    if (tStartIndex !== -1) {
      // If we have the start tag, take everything after it (or up to end tag)
      const end = tEndIndex !== -1 ? tEndIndex : fullText.length;
      cleanedText = fullText.substring(tStartIndex + textStartTag.length, end).trim();
    } else {
      // If no text tags, but visual tags exist, strip the visual block from the text
      if (vStartIndex !== -1 && vEndIndex !== -1) {
        const before = fullText.substring(0, vStartIndex);
        const after = fullText.substring(vEndIndex + visualEndTag.length);
        cleanedText = (before + after).trim();
      }
      // If no tags at all, keep fullText as is
    }

    // Final cleanup of any stray tags if regex missed something
    cleanedText = cleanedText.replace(/\[\[\[.*?\]\]\]/g, '').trim();

    return {
      cleanedText,
      visuals: { svg, table }
    };
  };

  const handleSend = async (textOverride?: string, optionsOverride?: GenerationOptions) => {
    const textToSend = textOverride || inputText;

    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: Sender.User,
      text: textToSend,
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setShowSizingModal(false);
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
      // Use overrides if provided, otherwise use state
      const options: GenerationOptions = optionsOverride || { useThinking, useSearch };

      const rawResponseText = await sendMessageToGemini(
        userMessage.text, 
        userMessage.attachments,
        options
      );
      
      // Parse the response to split text and visuals
      const { cleanedText, visuals } = parseResponse(rawResponseText);

      // Update Visual Panel if visuals found
      if (visuals.svg || visuals.table) {
        setVisualData(prev => ({
          svg: visuals.svg || null,
          table: visuals.table || null
        }));
      }

      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
        ? { ...msg, isThinking: false, text: cleanedText || "Dados técnicos gerados. Veja o painel lateral." }
        : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
        ? { 
            ...msg, 
            isThinking: false, 
            text: `## 1. Interpretação Normativa\n\n## 3. Riscos e Pontos Críticos\n\nErro de comunicação: ${(error as Error).message}\n\n## 5. Conclusão Profissional\nVerifique a conexão e tente novamente.` 
          }
        : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSizingSubmit = () => {
    if (!sizingData.type || !sizingData.standard) {
      alert("Por favor, preencha o Componente e a Norma.");
      return;
    }
    
    const prompt = `[SOLICITAÇÃO DE DADOS NORMATIVOS OFICIAIS]
    
ITEM: ${sizingData.type}
NORMA: ${sizingData.standard}
TAMANHO: ${sizingData.size || 'Não especificado'}
OBSERVAÇÕES: ${sizingData.pressure || '-'}

REQUISITOS OBRIGATÓRIOS:
1. Pesquise AGORA na web (Ferramenta Google Search) pelos valores exatos na norma solicitada (ex: wermac.org, asme.org).
2. NÃO ALUCINE VALORES. Use apenas os encontrados na pesquisa.
3. Gere a Tabela de Dimensões EXATAMENTE com este cabeçalho (4 colunas):
| Dimensão (Nome Usual) | Símbolo/Obs. | Valor (mm) | Ref. |

IMPORTANTE SOBRE A COLUNA 'Ref.':
- Se você encontrou o valor em um site, coloque o LINK REAL DA FONTE.
- Exemplo: [Wermac Table](https://www.wermac.org/...)
- Se o link direto não for claro, use um link de busca: [Buscar](https://www.google.com/search?q=${encodeURIComponent(sizingData.standard + ' ' + sizingData.type + ' dimensions')})`;
    
    // Force useSearch: true to ensure reliability
    handleSend(prompt, { useSearch: true, useThinking: false });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFilter = (filter: FilterKey) => {
    setActiveFilters(prev => {
      if (prev.includes(filter)) {
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
      
      {/* Live Audio Overlay */}
      {isLiveActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-8 text-white animate-in fade-in duration-500">
             <div className="relative">
                <div className="w-32 h-32 bg-blue-500/20 rounded-full animate-ping absolute top-0 left-0"></div>
                <div className="w-32 h-32 bg-blue-500/40 rounded-full animate-pulse absolute top-0 left-0 delay-150"></div>
                <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center relative z-10 border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                  <Mic size={48} className="text-blue-400" />
                </div>
             </div>
             <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Canal de Voz Ativo</h2>
                <p className="text-slate-400 font-mono text-sm">Conectado à Gemini 2.5 Native Audio</p>
             </div>
             <button 
               onClick={toggleLiveMode}
               className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold tracking-wide shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
             >
               <Phone className="rotate-135" size={20} />
               ENCERRAR CHAMADA
             </button>
          </div>
        </div>
      )}

      {/* Left Side - Visual Panel (LADO A) */}
      <div className="hidden lg:block w-[450px] shrink-0 h-full z-10">
        <VisualPanel svgContent={visualData.svg} tableContent={visualData.table} />
      </div>

      {/* Right Side - Chat Area (LADO B) */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Top Navigation / Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-1.5 rounded-md">
               <Hexagon size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-800 leading-tight">ENGENHEIRO.AI</h1>
              <p className="text-[10px] font-mono text-slate-400 tracking-widest">SYSTEM v2.5</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
               <FilterButton id="normas" label="NORMAS" icon={BookOpen} colorClass="text-blue-600 ring-1 ring-blue-100" />
               <FilterButton id="analise" label="ANÁLISE" icon={Cpu} colorClass="text-indigo-600 ring-1 ring-indigo-100" />
               <FilterButton id="riscos" label="RISCOS" icon={AlertTriangle} colorClass="text-amber-600 ring-1 ring-amber-100" />
               <FilterButton id="recomendacoes" label="RECOMEND." icon={Layers} colorClass="text-slate-600 ring-1 ring-slate-200" />
               <FilterButton id="conclusao" label="CONCLUSÃO" icon={CheckCircle} colorClass="text-emerald-600 ring-1 ring-emerald-100" />
             </div>
             <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
               <Settings size={18} />
             </button>
          </div>
        </header>

        {/* Chat Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar relative bg-[#f8fafc]">
          <div className="max-w-4xl mx-auto space-y-6 pb-32">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} activeFilters={activeFilters} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-12 pb-6 px-4 md:px-8 z-30">
          <div className="max-w-3xl mx-auto">
            
            {/* Feature Toggles Toolbar */}
            <div className="flex gap-2 mb-2 justify-end">
               <button 
                  onClick={() => {
                    setUseThinking(!useThinking);
                    if(!useThinking) setUseSearch(false); // Mutually exclusive preference
                  }}
                  className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded border transition-colors ${useThinking ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-slate-400 border-slate-200 hover:border-purple-200 hover:text-purple-500'}`}
                  title="Habilita raciocínio profundo (Gemini 3.0 Pro)"
               >
                 <Brain size={12} />
                 THINKING
               </button>
               
               <button 
                  onClick={() => {
                    setUseSearch(!useSearch);
                    if(!useSearch) setUseThinking(false);
                  }}
                  className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded border transition-colors ${useSearch ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-400 border-slate-200 hover:border-blue-200 hover:text-blue-500'}`}
                  title="Habilita pesquisa web (Google Search)"
               >
                 <Globe size={12} />
                 SEARCH
               </button>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl border border-slate-200 transition-all duration-300 ${isInputMinimized ? 'p-2' : 'p-4'}`}>
              
              {/* Uploaded Files Preview */}
              {attachments.length > 0 && !isInputMinimized && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center gap-2 shrink-0 w-48">
                      <div className="bg-white p-1.5 rounded border border-slate-100">
                        <ScrollText size={14} className="text-blue-500"/>
                      </div>
                      <span className="text-xs text-slate-600 truncate flex-1">{att.name || 'Anexo'}</span>
                      <button 
                        onClick={() => removeAttachment(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-slate-400 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Descreva o componente, norma ou anexe um documento técnico..."
                    className="w-full resize-none bg-transparent border-0 focus:ring-0 p-0 text-slate-700 placeholder:text-slate-400 text-sm leading-relaxed max-h-32"
                    rows={isInputMinimized ? 1 : 2}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                   <button 
                      onClick={() => setShowSizingModal(true)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Assistente de Dimensionamento"
                   >
                      <Ruler size={20} />
                   </button>
                   
                   <input 
                      type="file" 
                      multiple 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileSelect}
                      accept=".pdf,.txt,image/*" 
                   />
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Anexar arquivo"
                   >
                      <Paperclip size={20} />
                   </button>
                   
                   <div className="h-6 w-px bg-slate-200 mx-1"></div>

                   <button 
                      onClick={toggleLiveMode}
                      className={`p-2 rounded-lg transition-all ${isLiveActive ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      title="Modo Voz (Live API)"
                   >
                      <Radio size={20} />
                   </button>

                   <button 
                      onClick={() => handleSend()}
                      disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
                      className={`bg-slate-900 hover:bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 ${useThinking ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                   >
                      <Send size={18} />
                   </button>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-3 font-mono">
              Engenheiro.AI pode cometer erros. Verifique informações importantes (ABNT/ISO/ASME).
            </p>
          </div>
        </div>
      </div>

      {/* Sizing Modal (Simplified for Demo) */}
      {showSizingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Ruler size={18} className="text-blue-600"/>
                   Dimensionamento Rápido
                 </h3>
                 <button onClick={() => setShowSizingModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Componente</label>
                   <input 
                      type="text" 
                      placeholder="Ex: Parafuso, Eixo, Flange..." 
                      className="w-full rounded border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                      value={sizingData.type}
                      onChange={e => setSizingData({...sizingData, type: e.target.value})}
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Norma</label>
                      <input 
                          type="text" 
                          placeholder="Ex: DIN 933" 
                          className="w-full rounded border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                          value={sizingData.standard}
                          onChange={e => setSizingData({...sizingData, standard: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tamanho</label>
                      <input 
                          type="text" 
                          placeholder="Ex: M12, Ø50mm" 
                          className="w-full rounded border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                          value={sizingData.size}
                          onChange={e => setSizingData({...sizingData, size: e.target.value})}
                      />
                    </div>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhes / Classe</label>
                   <input 
                      type="text" 
                      placeholder="Ex: 8.8, Aço Inox, PN10..." 
                      className="w-full rounded border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                      value={sizingData.pressure}
                      onChange={e => setSizingData({...sizingData, pressure: e.target.value})}
                   />
                 </div>
                 
                 <button 
                    onClick={handleSizingSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-md shadow-blue-600/20"
                 >
                    <Cpu size={16} />
                    Gerar Especificação
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;