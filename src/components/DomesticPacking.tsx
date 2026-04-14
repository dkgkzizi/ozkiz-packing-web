'use client';

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Sparkles, 
  ChevronRight, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trash2,
  Table,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type PackingItem = {
  productName: string;
  color: string;
  size: string;
  qty: number;
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
        reader.onload = (e) => setPreview(e.target?.result as string);
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

      const res = await fetch('/api/domestic/convert', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.items);
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error(e);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!results) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('국내패킹리스트');
    
    worksheet.columns = [
      { header: '상품명', key: 'productName', width: 40 },
      { header: '색상', key: 'color', width: 15 },
      { header: '사이즈', key: 'size', width: 12 },
      { header: '수량', key: 'qty', width: 12 }
    ];

    results.forEach(item => worksheet.addRow(item));
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `국내패킹_${new Date().toISOString().slice(0,10)}.xlsx`);
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
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Domestic Packing Sync
          </div>
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-4">
          Domestic <span className="text-orange-500">Packing</span>
        </h1>
        <p className="text-slate-500 font-bold max-w-2xl leading-relaxed">
          국내 공장에서 도착한 수기 전표나 거래명세표를 AI가 분석합니다. <br />
          이미지 한 장으로 재고 데이터를 즉시 엑셀로 변환하세요.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Control Panel */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Analyze Configuration
            </h3>

            <div className="space-y-4 mb-8">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                    type === t.id 
                    ? 'bg-orange-600/10 border-orange-500/50 text-white' 
                    : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">{t.name}</div>
                  <div className="text-[10px] opacity-60 font-bold uppercase tracking-widest">{t.desc}</div>
                </button>
              ))}
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative group h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
                file ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
              }`}
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
              />
              {preview ? (
                   <img src={preview} className="absolute inset-0 w-full h-full object-contain p-4 opacity-40 group-hover:opacity-60 transition-opacity" alt="Preview" />
              ) : file?.type === 'application/pdf' ? (
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Table className="w-24 h-24 text-orange-500/20" />
                   </div>
              ) : null}

              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
                  file ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-500'
                }`}>
                  <FileUp className="w-8 h-8" />
                </div>
                <p className="text-white font-black text-sm tracking-tight mb-1">{file ? file.name : 'UPLOAD FILE'}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'IMAGE OR PDF'}</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={handleProcess}
                disabled={!file || loading}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                <span>{loading ? 'ANALYZING...' : 'START ANALYSIS'}</span>
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
                Analysis Results
              </h3>
              {results && (
                <button 
                  onClick={handleDownload}
                  className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-lg flex items-center gap-2 transition-all border border-white/10"
                >
                  <Download className="w-3 h-3 text-orange-400" />
                  Export .XLSX
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-0">
               <AnimatePresence mode="wait">
                 {loading ? (
                   <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     className="h-full flex flex-col items-center justify-center p-12 text-center"
                   >
                     <div className="w-24 h-24 relative mb-6">
                        <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
                        <div className="relative w-full h-full border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                     </div>
                     <p className="text-xl font-black text-white italic tracking-tighter mb-2">AI ENGINE SCANNING...</p>
                     <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">수기 문자를 디지털 데이터로 변환 중입니다</p>
                   </motion.div>
                 ) : results ? (
                   <motion.table 
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                     className="w-full text-left border-collapse"
                   >
                     <thead>
                       <tr className="bg-white/2 border-b border-white/5">
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product Name</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Color</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Size</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {results.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/2 transition-colors group">
                           <td className="p-6 border-r border-white/5">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-[10px] group-hover:scale-110 transition-transform">
                                 {idx + 1}
                               </div>
                               <span className="text-sm font-bold text-white tracking-tight">{item.productName}</span>
                             </div>
                           </td>
                           <td className="p-6 text-center text-sm font-bold text-slate-400 border-r border-white/5">{item.color}</td>
                           <td className="p-6 text-center text-sm font-bold text-slate-400 border-r border-white/5">{item.size}</td>
                           <td className="p-6 text-center">
                             <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-black">{item.qty}</span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </motion.table>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30 grayscale">
                     <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                        <Table className="w-10 h-10 text-slate-600" />
                     </div>
                     <p className="text-sm font-black text-slate-600 uppercase tracking-widest italic">No Data Analyzed</p>
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
