import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Grid, FileText } from 'lucide-react';

interface VisualPanelProps {
  svgContent: string | null;
  tableContent: string | null;
}

const VisualPanel: React.FC<VisualPanelProps> = ({ svgContent, tableContent }) => {
  const [zoom, setZoom] = useState(100);

  // Helper to parse markdown links within table cells
  const renderCellContent = (text: string) => {
    // Match [Text](URL)
    const linkMatch = text.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
        return (
            <a 
              href={linkMatch[2]} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:underline hover:text-blue-700 font-medium"
            >
              {linkMatch[1]}
            </a>
        );
    }
    return text;
  };

  // Helper to convert Markdown Table string to HTML structure
  const renderTable = (markdown: string) => {
    const rows = markdown.trim().split('\n').filter(r => r.trim().startsWith('|'));
    if (rows.length < 2) return <div className="text-slate-400 italic">Tabela inválida</div>;

    return (
      <div className="overflow-x-auto rounded bg-white border border-slate-300 shadow-sm" style={{ fontSize: `${Math.max(80, zoom * 0.8)}%` }}>
        <table className="w-full font-sans text-left border-collapse text-sm text-slate-900">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
              {rows[0].split('|').filter(c => c.trim()).map((header, i) => (
                <th key={i} className="p-3 border-r border-slate-200 last:border-r-0 whitespace-nowrap font-bold uppercase text-xs tracking-wider">
                  {header.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(2).map((row, i) => (
              <tr key={i} className="border-b border-slate-200 hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                {row.split('|').filter(c => c.trim()).map((cell, j) => (
                  <td key={j} className="p-2 border-r border-slate-200 last:border-r-0 whitespace-nowrap font-mono text-xs">
                    {renderCellContent(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!tableContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 border-l border-slate-200 bg-slate-50">
        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
          <Grid className="text-slate-400" size={32} />
        </div>
        <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-2">Painel de Dados</h3>
        <p className="text-center text-xs max-w-[200px]">
          As tabelas dimensionais aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-800 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="text-blue-500" size={16} />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Especificação Técnica</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Diminuir Fonte"><ZoomOut size={14}/></button>
          <span className="text-[10px] font-mono text-slate-500 self-center w-8 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Aumentar Fonte"><ZoomIn size={14}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar-dark">
        
        {/* Table Viewer Section */}
        {tableContent && (
          <div className="space-y-2 pb-10">
             <div className="flex items-center justify-between text-blue-400/80 border-b border-blue-900/50 pb-1">
                <span className="text-[10px] font-mono uppercase">Tabela Dimensional</span>
             </div>
             {renderTable(tableContent)}
          </div>
        )}

      </div>

      {/* Footer Status */}
      <div className="h-8 bg-slate-950 border-t border-slate-800 flex items-center justify-end px-4 shrink-0">
         <span className="text-[10px] text-slate-600 font-mono">DADOS NORMATIVOS ABNT/ISO</span>
      </div>
    </div>
  );
};

export default VisualPanel;