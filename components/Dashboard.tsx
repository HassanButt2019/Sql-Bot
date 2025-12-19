
import React, { useState } from 'react';
import { DashboardItem } from '../types';
import SqlChart from './SqlChart';
import { 
  Trash2Icon, 
  Maximize2Icon, 
  LayoutGridIcon, 
  PlusCircleIcon, 
  ClockIcon, 
  DownloadIcon, 
  Share2Icon,
  CheckIcon,
  FileSpreadsheetIcon,
  PrinterIcon
} from 'lucide-react';

interface DashboardProps {
  items: DashboardItem[];
  title?: string;
  onRemove: (id: string) => void;
  onResize: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ items, title = "Analytics Dashboard", onRemove, onResize }) => {
  const [showShareToast, setShowShareToast] = useState(false);

  const handleExportPDF = () => {
    // Small delay to ensure any dynamic charts are ready for capture
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;

    // We'll export the first item's data as a sample or merge all? 
    // Let's create a bundle of all charts in one CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    items.forEach(item => {
      csvContent += `\n# --- Widget: ${item.title} ---\n`;
      if (item.chartData.length > 0) {
        const headers = Object.keys(item.chartData[0]);
        csvContent += headers.join(",") + "\n";
        item.chartData.forEach(row => {
          csvContent += headers.map(h => row[h]).join(",") + "\n";
        });
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = () => {
    const dummyLink = `${window.location.origin}/share/db_${Date.now()}`;
    navigator.clipboard.writeText(dummyLink).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    });
  };

  return (
    <div className="p-8 max-w-full mx-auto dashboard-container relative">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded tracking-wider">Workspace</span>
             <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          </div>
          <p className="text-slate-500 font-medium">Your persistent command center for SQL-driven insights.</p>
        </div>
        
        <div className="flex items-center gap-3 export-controls no-print">
          <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm">
            <LayoutGridIcon className="w-4 h-4 text-blue-500" />
            <span>{items.length} WIDGETS</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportPDF}
              title="Print to PDF"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <PrinterIcon className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button 
              onClick={handleExportCSV}
              title="Export as CSV"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <FileSpreadsheetIcon className="w-4 h-4 text-green-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button 
              onClick={handleShare}
              title="Copy Share Link"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <Share2Icon className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">SHARE</span>
            </button>
          </div>
        </div>
      </header>

      {showShareToast && (
        <div className="fixed top-20 right-8 z-[60] animate-in slide-in-from-right-10 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
              <CheckIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">Share link copied!</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ready to send</p>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-dashed border-slate-300 shadow-inner">
          <div className="bg-slate-50 p-6 rounded-3xl mb-6 shadow-sm">
            <PlusCircleIcon className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Build your report</h2>
          <p className="text-slate-500 mt-3 max-w-sm text-center leading-relaxed font-medium">
            Analyze datasets in the chat, then pin charts to this dashboard to create your custom view.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {items.map((item) => {
            let spanClass = "md:col-span-6";
            if (item.colSpan === 4) spanClass = "md:col-span-4";
            if (item.colSpan === 6) spanClass = "md:col-span-6";
            if (item.colSpan === 12) spanClass = "md:col-span-12";

            return (
              <div 
                key={item.id} 
                className={`group relative transition-all duration-300 ease-in-out min-w-0 ${spanClass}`}
              >
                <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 no-print">
                  <button
                    onClick={() => onResize(item.id)}
                    title="Change Widget Size"
                    className="bg-white/90 backdrop-blur text-slate-700 p-2.5 rounded-xl hover:bg-white transition-all shadow-xl border border-slate-100 hover:scale-110"
                  >
                    <Maximize2Icon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    title="Remove from Dashboard"
                    className="bg-red-50/90 backdrop-blur text-red-600 p-2.5 rounded-xl hover:bg-red-100 transition-all shadow-xl border border-red-100 hover:scale-110"
                  >
                    <Trash2Icon className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/5 transition-all">
                  <SqlChart
                    type={item.chartConfig.type}
                    data={item.chartData}
                    xAxis={item.chartConfig.xAxis}
                    yAxis={item.chartConfig.yAxis}
                    title={item.title}
                    height={item.height}
                  />
                  
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Data</span>
                     </div>
                     <span className="text-[10px] text-slate-300 font-medium italic">Added {new Date(item.addedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <footer className="mt-12 pt-8 border-t border-slate-100 hidden print:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">S</div>
          <div>
            <p className="font-bold text-slate-900">{title} - SQLMind Report</p>
            <p className="text-xs text-slate-400">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enterprise Analytics</p>
          <p className="text-[10px] text-slate-300">© 2024 SQLMind Analytics Suite</p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
