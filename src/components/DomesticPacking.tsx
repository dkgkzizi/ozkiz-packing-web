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
  CheckCircle2
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target?.result as string);
        reader.readAsDataURL(f);
      } else {
        setPreview(null);
      }
    }
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
    } catch (e) {
      console.error(e);
      alert('분석 및 매칭 중 오류가 발생했습니다.');
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
      { header: '인식상품명', key: 'productName', width: 30 },
      { header: '색상', key: 'color', width: 12 },
      { header: '사이즈', key: 'size', width: 10 },
      { header: '수량', key: 'qty', width: 10 }
    ];

    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED8936' } }; // Orange

    results.forEach(item => worksheet.addRow(item));
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `국내매칭_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
      {/* Header Area */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 2
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Search className="w-3 h-3" />
            <span>Supabase Live Sync Ready</span>
          </div>
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-4">
          Domestic <span className="text-orange-500">Master</span>
        </h1>
        <p className="text-slate-500 font-bold max-w-2xl leading-relaxed">
          AI 분석 즉시 수파베이스 DB와 6단계 정밀 대조를 시작합니다. <br />
          더 빠르고 정확하게 정식 상품코드를 찾아내어 엑셀로 변환합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Control Panel */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Search className="w-32 h-32 text-white" />
            </div>
            
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Real-time DB Matcher
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`text-center p-3 rounded-2xl border transition-all duration-300 ${
                    type === t.id 
                    ? 'bg-orange-600/10 border-orange-500/50 text-white ring-1 ring-orange-500/20' 
                    : 'bg-white/2 border-transparent text-slate-500 hover:bg-white/5'
                  }`}
                >
                  <div className="font-black text-[11px] mb-1">{t.name.split(' ')[0]}</div>
                  <div className="text-[8px] opacity-40 font-bold uppercase tracking-widest leading-none">{t.desc.split(' ')[0]}</div>
                </button>
              ))}
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
                file ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/80 shadow-inner'
              }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" />
              {preview && <img src={preview} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="Preview" />}

              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
                  file ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/40' : 'bg-slate-800 text-slate-500'
                }`}>
                  <FileUp className="w-8 h-8" />
                </div>
                <p className="text-white font-black text-sm tracking-tight mb-1">{file ? file.name : 'DROP INVOICE'}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">JPG, PNG OR PDF</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={handleProcess}
                disabled={!file || loading}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>{loading ? 'SYNCING...' : 'RUN ANALYTICS'}</span>
              </button>
              {file && (
                <button 
                  onClick={() => {setFile(null); setPreview(null); setResults(null);}}
                  className="w-16 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-white/5"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Results Table */}
        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl h-full flex flex-col backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[600px]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Table className="w-4 h-4 text-orange-500" />
                Consolidated Data
              </h3>
              {results && (
                <button onClick={handleDownload} className="bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-black uppercase tracking-widest py-2 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20">
                  <Download className="w-3 h-3" />
                  EXPORT SYNCED DATA
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
               <AnimatePresence mode="wait">
                 {loading ? (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                     <div className="w-24 h-24 border-b-2 border-orange-500 rounded-full animate-spin mb-6" />
                     <p className="text-xl font-black text-white italic tracking-tighter mb-2">CROSS-REFERENCING DB...</p>
                     <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">수파베이스 글로벌 마스터와 대조 중</p>
                   </div>
                 ) : results ? (
                   <table className="w-full text-left border-collapse">
                     <thead className="sticky top-0 z-10">
                       <tr className="bg-slate-900 border-b border-white/5">
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Code</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Matched Name</th>
                         <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                         <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {results.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/2 transition-colors">
                           <td className="p-6">
                             <span className={`text-[11px] font-black tracking-widest px-3 py-1.5 rounded-lg ${
                               item.matchedCode === '미매칭' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                             }`}>
                               {item.matchedCode}
                             </span>
                           </td>
                           <td className="p-6">
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-white tracking-tight leading-none mb-1.5">{item.matchedName}</span>
                               <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-none">OCR: {item.productName} ({item.color}/{item.size})</span>
                             </div>
                           </td>
                           <td className="p-4 text-center">
                             <span className="text-sm font-black text-orange-400">{item.qty}</span>
                           </td>
                           <td className="p-4 text-center">
                             {item.matchedCode !== '미매칭' ? (
                               <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                                 <CheckCircle2 className="w-3 h-3 text-green-500" />
                               </div>
                             ) : (
                               <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                                 <AlertCircle className="w-3 h-3 text-red-500" />
                               </div>
                             )}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-20">
                     <Search className="w-20 h-20 text-slate-600 mb-6" />
                     <p className="text-sm font-black text-slate-600 uppercase tracking-widest italic">Waiting for Input</p>
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

function AlertCircle(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
