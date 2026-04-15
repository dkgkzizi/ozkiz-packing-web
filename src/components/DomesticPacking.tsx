'use client';

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Sparkles, 
  ChevronRight, 
  Download, 
  Loader2,
  Table,
  Search,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type PackingItem = {
  productName: string;
  color: string;
  size: string;
  qty: number;
  matchedCode: string;
  matchedName: string;
  season: string;
};

export default function DomesticPacking() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackingItem[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'master_match'); 

      const res = await fetch('/api/domestic/convert', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) setResults(data.items);
      else alert(data.message);
    } catch (e: any) {
      alert('매칭 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!results) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('국내매칭결과');
    worksheet.columns = [
      { header: '상품코드', key: 'matchedCode', width: 20 },
      { header: '상품명', key: 'matchedName', width: 40 },
      { header: '색상', key: 'color', width: 15 },
      { header: '사이즈', key: 'size', width: 12 },
      { header: '작업수량', key: 'qty', width: 15 },
      { header: '메모', key: 'memo', width: 25 }
    ];
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    results.forEach(item => worksheet.addRow({ ...item, memo: `${memoDate}_국내 입고` }));
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `국내매칭_${memoDate}.xlsx`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4 font-sans">
          <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest border border-orange-200">
            CATEGORY 1
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Domestic Master Reconciler
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">
          Domestic <span className="text-orange-500">Master</span>
        </h2>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           국내 매킹 리스트의 지능형 마스터 매칭을 시작합니다. <br />
           글로벌 표준 양식으로 즉시 변환됩니다.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 transition-all hover:shadow-2xl">
            <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()} 
                className={`relative h-72 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                    isDragging ? 'border-orange-500 bg-orange-50' : 
                    file ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileUp className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'File Detected' : 'Drag Source'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">
                   {file ? file.name : 'Domestic Excel/Image'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-slate-900 hover:bg-slate-800 disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span className="text-lg tracking-tighter uppercase font-black italic">Start Logic</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden min-h-[500px]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <Table className="w-4 h-4 text-orange-500" />
                Live Sync Stream
              </h3>
              {results && (
                <button onClick={handleDownload} className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase py-2 px-6 rounded-full transition-all shadow-md active:scale-95">
                  <Download className="w-3 h-3 mr-2 inline" /> Export XLSX
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto">
               {loading ? (
                 <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                   <div className="w-16 h-16 border-[4px] border-slate-100 border-t-orange-500 rounded-full animate-spin mb-6" />
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Mastering Data...</p>
                 </div>
               ) : results ? (
                 <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                     <tr>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Code</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matched Name</th>
                       <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {results.map((item, idx) => (
                       <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                         <td className="p-6">
                            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-lg ${
                                item.matchedCode === '미매칭' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-600 border border-orange-100'
                            }`}>
                                {item.matchedCode}
                            </span>
                         </td>
                         <td className="p-6">
                            <span className="text-sm font-bold text-slate-800 block mb-1">{item.matchedName}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase truncate block">Orig: {item.productName}</span>
                         </td>
                         <td className="p-4 text-center">
                            <span className="text-sm font-black text-slate-900">{item.qty}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-slate-400 grayscale scale-[0.7]">
                   <Search className="w-16 h-16 mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Ready for feed</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
