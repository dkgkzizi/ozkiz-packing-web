'use client';

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Sparkles, 
  ChevronRight, 
  Download, 
  Loader2,
  Trash2,
  Table,
  Search,
  CheckCircle2,
  Calendar,
  FileSpreadsheet
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

const TYPES = [
  { id: 'naeju', name: '내주 (수기)', desc: '공장 수기 전표' },
  { id: 'minju', name: '민주 (거래)', desc: '거래명세표 양식' },
  { id: 'sejong', name: '세종 (거래)', desc: '세종 업체 양식' }
];

export default function DomesticPacking() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState('naeju');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackingItem[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/domestic/convert', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResults(data.items);
      } else {
        alert(data.message);
      }
    } catch (e: any) {
      console.error(e);
      alert('분석 및 매칭 중 오류가 발생했습니다: ' + e.message);
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
      { header: '표준상품명', key: 'matchedName', width: 40 },
      { header: '시즌', key: 'season', width: 12 },
      { header: '색상', key: 'color', width: 12 },
      { header: '사이즈', key: 'size', width: 10 },
      { header: '수량', key: 'qty', width: 10 }
    ];

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED8936' } };

    results.forEach(item => worksheet.addRow(item));
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `국내매칭_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 2
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-3 h-3 text-orange-400" />
            <span>Robust Matcher Active</span>
          </div>
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-4">
          Domestic <span className="text-orange-500">Elite</span>
        </h1>
        <p className="text-slate-500 font-bold max-w-2xl leading-relaxed">
          이미지 분석 및 정교한 엑셀 매칭을 동시에 지원합니다. <br />
          유사도 80% 이상의 최신 시즌 상품을 수파베이스에서 즉시 찾아냅니다.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <FileSpreadsheet className="w-32 h-32 text-orange-500" />
            </div>

            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Analyze Configuration
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`text-center p-4 rounded-2xl border transition-all duration-300 ${
                    type === t.id ? 'bg-orange-600/10 border-orange-500/50 text-white shadow-[0_0_20px_rgba(239,104,15,0.1)]' : 'bg-white/2 border-transparent text-slate-500 hover:bg-white/5'
                  }`}
                >
                  <div className="font-black text-[12px] mb-1">{t.name.split(' ')[0]}</div>
                  <div className="text-[8px] opacity-40 font-bold uppercase tracking-widest leading-none">{t.desc.split(' ')[0]}</div>
                </button>
              ))}
            </div>

            <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()} 
                className={`relative h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                    isDragging ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' : 
                    file ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/80 shadow-inner'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.xlsx,.xls,.csv" />
              {preview && <img src={preview} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="Preview" />}
              
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
                  file ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/40' : 'bg-slate-800 text-slate-500'
                }`}>
                  <FileUp className="w-8 h-8" />
                </div>
                <p className="text-white font-black text-sm tracking-tight">{file ? file.name : 'DROP FILE HERE'}</p>
                <p className="text-[9px] font-black text-slate-600 mt-2 uppercase tracking-widest">Image, PDF, or Excel</p>
              </div>
            </div>

            <button onClick={handleProcess} disabled={!file || loading} className="w-full mt-8 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (file?.name.match(/\.(xlsx|xls|csv)$/i) ? <FileSpreadsheet className="w-6 h-6" /> : <Search className="w-6 h-6" />)}
              <span className="text-lg tracking-tighter">{file?.name.match(/\.(xlsx|xls|csv)$/i) ? '매칭 프로세스 실행' : '분석 및 시즌 매칭 시작'}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl h-full flex flex-col backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[600px]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Table className="w-4 h-4 text-orange-500" />
                Matching Preview
              </h3>
              {results && (
                <button onClick={handleDownload} className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest py-2 px-6 rounded-xl flex items-center gap-2 transition-all border border-white/10">
                  <Download className="w-3 h-3 text-orange-400" />
                  Download XLSX
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
               <AnimatePresence mode="wait">
                 {loading ? (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center text-glow-orange">
                     <div className="w-24 h-24 border-b-2 border-orange-500 rounded-full animate-spin mb-6" />
                     <p className="text-xl font-black text-white italic tracking-tighter mb-2 animate-pulse">CROSS-REFERENCING MASTER DB...</p>
                   </div>
                 ) : results ? (
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-900/50 border-b border-white/5">
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Code</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Matched Name</th>
                         <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Season</th>
                         <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {results.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/2 transition-colors">
                           <td className="p-6">
                             <span className={`text-[11px] font-black tracking-widest px-3 py-1.5 rounded-lg ${
                               item.matchedCode === '미매칭' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                             }`}>
                               {item.matchedCode}
                             </span>
                           </td>
                           <td className="p-6">
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-white tracking-tight leading-none mb-1.5">{item.matchedName}</span>
                               <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Source: {item.productName} ({item.color}/{item.size})</span>
                             </div>
                           </td>
                           <td className="p-4 text-center text-[10px] font-bold text-slate-500">{item.season}</td>
                           <td className="p-4 text-center">
                             <span className="text-sm font-black text-orange-400">{item.qty}</span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-10">
                     <Search className="w-20 h-20 mb-6" />
                     <p className="text-sm font-black uppercase tracking-widest italic">Waiting for analysis</p>
                   </div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
