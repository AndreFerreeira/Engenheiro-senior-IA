import React from 'react';
import { Message, Sender, FilterKey } from '../types';
import { User, Bot, FileText, AlertTriangle, CheckCircle, BookOpen, Activity, Cpu, Layers, FileDown, ExternalLink } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  activeFilters?: FilterKey[];
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, activeFilters }) => {
  const isUser = message.sender === Sender.User;

  // Helper to parse bold markdown (**text**) into React elements
  const formatText = (text: string) => {
    // Split by double asterisks
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove asterisks and render strong tag
        return <strong key={i} className="font-semibold text-slate-900 bg-slate-100 px-1 rounded">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const handleExportPDF = () => {
    // Create a printable version of the content
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contentHtml = document.getElementById(`msg-content-${message.id}`)?.innerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Técnico - Engenheiro.AI</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
          @page { margin: 2cm; }
          .break-inside-avoid { break-inside: avoid; }
        </style>
      </head>
      <body class="bg-white text-slate-900 p-8 max-w-4xl mx-auto">
        
        <!-- Header -->
        <div class="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
          <div>
            <h1 class="text-2xl font-bold uppercase tracking-tight text-slate-900">Relatório Técnico</h1>
            <p class="text-sm text-slate-500 mt-1 font-mono">Gerado por Engenheiro.AI Professional</p>
          </div>
          <div class="text-right text-xs font-mono text-slate-500">
            <p>DATA: ${new Date().toLocaleDateString()}</p>
            <p>REF: ${message.id.slice(0,8).toUpperCase()}</p>
          </div>
        </div>

        <!-- Content -->
        <div class="space-y-6 text-sm leading-relaxed">
          ${contentHtml}
        </div>

        <!-- Footer -->
        <div class="mt-12 pt-6 border-t border-slate-200 text-[10px] text-center text-slate-400 font-mono uppercase">
          Documento gerado automaticamente para fins de consulta técnica. Valide com as normas oficiais vigentes.
          <br/>
          Engenheiro.AI System v2.5
        </div>

        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Simple parser to highlight specific technical sections returned by the AI
  const renderBotResponse = (text: string) => {
    // Split by the known headers defined in the system prompt
    // Note: Updated Regex to catch the new headers
    const sections = text.split(/(?=## \d\. )/g);

    return (
      <div id={`msg-content-${message.id}`} className="space-y-3 w-full">
        {sections.map((section, index) => {
          const trimmed = section.trim();
          if (!trimmed) return null;

          let title = "";
          let content = trimmed;
          let variant: 'default' | 'warning' | 'success' | 'info' | 'norm' = 'default';
          let Icon = Activity;
          let filterKey: FilterKey | null = null;

          // Matching new Prompt Headers
          if (trimmed.startsWith('## 1. Interpretação Normativa')) {
             title = "Interpretação Normativa";
             content = trimmed.replace('## 1. Interpretação Normativa', '').trim();
             variant = 'norm';
             Icon = BookOpen;
             filterKey = 'normas';
          } else if (trimmed.startsWith('## 2. Avaliação Técnica')) {
             title = "Avaliação Técnica";
             content = trimmed.replace('## 2. Avaliação Técnica', '').trim();
             variant = 'info';
             Icon = Cpu;
             filterKey = 'analise';
          } else if (trimmed.startsWith('## 3. Riscos e Pontos Críticos')) {
             title = "Riscos e Pontos Críticos";
             content = trimmed.replace('## 3. Riscos e Pontos Críticos', '').trim();
             variant = 'warning';
             Icon = AlertTriangle;
             filterKey = 'riscos';
          } else if (trimmed.startsWith('## 4. Recomendações')) {
             title = "Recomendações Técnicas";
             content = trimmed.replace('## 4. Recomendações', '').trim();
             variant = 'default';
             Icon = Layers;
             filterKey = 'recomendacoes';
          } else if (trimmed.startsWith('## 5. Conclusão Profissional')) {
             title = "Conclusão Profissional";
             content = trimmed.replace('## 5. Conclusão Profissional', '').trim();
             variant = 'success';
             Icon = CheckCircle;
             filterKey = 'conclusao';
          } else {
              // Backwards compatibility or intro text
              return (
                <div key={index} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-slate-700 break-inside-avoid">
                  <div className="whitespace-pre-wrap">{formatText(trimmed)}</div>
                </div>
              );
          }

          // CHECK FILTER: If specific filter logic is active and this key is NOT in it, return null
          if (filterKey && activeFilters && !activeFilters.includes(filterKey)) {
            return null;
          }

          // Card Styles based on variant
          const getCardStyles = () => {
            switch(variant) {
              case 'warning': 
                return {
                  container: "bg-white border-l-4 border-l-amber-500 border-y border-r border-slate-200",
                  header: "text-amber-700 bg-amber-50/50 border-b border-slate-100",
                  icon: "text-amber-500"
                };
              case 'success': 
                return {
                  container: "bg-emerald-50/30 border border-emerald-200",
                  header: "text-emerald-800 border-b border-emerald-100 bg-emerald-100/50",
                  icon: "text-emerald-600"
                };
              case 'norm': 
                return {
                  container: "bg-white border-l-4 border-l-blue-500 border-y border-r border-slate-200",
                  header: "text-blue-800 bg-blue-50/50 border-b border-slate-100",
                  icon: "text-blue-600"
                };
              case 'info':
                return {
                  container: "bg-white border-l-4 border-l-indigo-500 border-y border-r border-slate-200",
                  header: "text-indigo-800 bg-indigo-50/50 border-b border-slate-100",
                  icon: "text-indigo-600"
                };
              default: 
                return {
                  container: "bg-white border border-slate-200",
                  header: "text-slate-600 bg-slate-50 border-b border-slate-100",
                  icon: "text-slate-500"
                };
            }
          };

          const styles = getCardStyles();

          return (
            <div key={index} className={`rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md ${styles.container} animate-in fade-in duration-500 break-inside-avoid`}>
              {/* Card Header */}
              <div className={`px-4 py-2 flex items-center gap-2 ${styles.header}`}>
                <Icon size={14} className={styles.icon} />
                <span className="text-[11px] uppercase tracking-widest font-mono font-bold">
                  {title}
                </span>
              </div>
              
              {/* Card Body */}
              <div className="p-4 text-sm leading-relaxed text-slate-700 font-sans">
                <div className="whitespace-pre-wrap">
                  {formatText(content)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] lg:max-w-[75%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 rounded flex items-center justify-center border shadow-sm mt-1
          ${isUser ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-blue-600'}`}>
          {isUser ? <User size={16} /> : <Bot size={18} />}
        </div>

        {/* Message Content Wrapper */}
        <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
          
          {/* Attachments (User side) */}
          {isUser && message.attachments && message.attachments.length > 0 && (
             <div className="mb-2 flex flex-wrap gap-2 justify-end">
                {message.attachments.map((att, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded text-xs flex items-center gap-2 text-slate-600 shadow-sm">
                    <FileText size={12} className="text-slate-400" />
                    <span className="font-mono truncate max-w-[200px]">{att.name || 'Documento Anexado'}</span>
                  </div>
                ))}
              </div>
          )}

          {/* The Message Block */}
          {isUser ? (
            // User Message Style
            <div className="bg-slate-800 text-slate-50 p-4 rounded-lg rounded-tr-none shadow-md text-sm leading-relaxed max-w-2xl border border-slate-700">
               <div className="whitespace-pre-wrap font-light">{message.text}</div>
            </div>
          ) : (
            // Bot Message Style (Blocks)
            <div className="w-full group relative">
               {message.isThinking ? (
                 <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm w-fit">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wide">Processando Engenharia...</span>
                 </div>
               ) : (
                 <>
                    {renderBotResponse(message.text)}
                    
                    {/* Bot Action Bar */}
                    <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-1.5 text-[10px] font-medium bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors shadow-sm"
                        title="Gerar PDF deste relatório"
                      >
                        <FileDown size={12} />
                        <span>BAIXAR RELATÓRIO</span>
                      </button>
                      <button 
                        className="flex items-center gap-1.5 text-[10px] font-medium bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors shadow-sm"
                        onClick={() => window.open('https://www.abntcatalogo.com.br/', '_blank')}
                        title="Consultar catálogo ABNT"
                      >
                        <ExternalLink size={12} />
                        <span>CATÁLOGO ABNT</span>
                      </button>
                    </div>
                 </>
               )}
            </div>
          )}
          
          {/* Timestamp */}
          <span className={`text-[10px] font-mono text-slate-400 mt-2 opacity-70 ${isUser ? 'mr-1' : 'ml-1'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;