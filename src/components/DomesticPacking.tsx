'use client';

import React, { useState, useRef, useEffect } from 'react';
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

  // 드래그 앤 드롭 핸들러 강화
  const onDragOver = (e: React.DragEvent) => { 
    e.preventDefault(); 
    e.stopPropagation();
    setIsDragging(true); 
  };
  const onDragLeave = (e: React.DragEvent) => { 
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false); 
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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
      // AI 관련 타입 제거, 순수 매칭으로만 전송
      formData.append('type', 'master_match'); 

      const res = await fetch('/api/domestic/convert', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResults(data.items);
      } else {
        alert(data.message);
      }
    } catch (e: any) {
      console.error(e);
      alert('매칭 프로세스 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!results) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('국내매칭결과');
    
    // 인도 패킹리스트와 동일한 구조 (A: 코드, B: 이름, C: 색상, D: 사이즈, E: 수량, F: 메모)
    worksheet.columns = [
      { header: '상품코드', key: 'matchedCode', width: 20 },
      { header: '상품명', key: 'matchedName', width: 40 },
      { header: '색상', key: 'color', width: 15 },
      { header: '사이즈', key: 'size', width: 12 },
      { header: '작업수량', key: 'qty', width: 15 },
      { header: '메모', key: 'memo', width: 25 }
    ];

    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const memoContent = `${memoDate}_국내 입고`;

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // 인도패킹용 블루

    results.forEach(item => {
      worksheet.addRow({
        matchedCode: item.matchedCode,
        matchedName: item.matchedName,
        color: item.color,
        size: item.size,
        qty: item.qty,
        memo: memoContent
      });
    });

    // 테두리 및 정렬 스타일 적용
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `국내매칭완료_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4 font-sans">
          <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 2
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Domestic Master Matcher
          </div>
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2">
          Domestic <span className="text-orange-500">Master</span>
        </h1>
        <p className="text-slate-500 font-bold max-w-2xl leading-relaxed">
          국내 패킹 원본 파일을 수파베이스 마스터 DB와 연동합니다. <br />
          인도 패킹과 동일한 표준화된 엑셀 파일을 생성합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Selection Area */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                <FileSpreadsheet className="w-48 h-48 text-orange-500" />
            </div>

            <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()} 
                className={`relative h-80 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                    isDragging ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' : 
                    file ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 shadow-inner'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" />
              
              <div className="relative z-10 flex flex-col items-center p-6 text-center">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-500 ${
                  file ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-slate-800 text-slate-500'
                }`}>
                  <FileUp className="w-10 h-10" />
                </div>
                <h4 className="text-white font-black text-lg tracking-tight mb-2 uppercase">{file ? 'File Armed' : 'Upload Source'}</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed">
                   {file ? file.name : 'Drag and Drop Domestic \n Excel File here'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-orange-600 hover:bg-orange-500 disabled:opacity-20 text-white font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Search className="w-6 h-6 text-white group-hover:scale-125 transition-transform" />}
              <span className="text-xl tracking-tighter uppercase font-black italic">Execute Matching</span>
            </button>
          </div>
        </div>

        {/* Data Area */}
        <div className="lg:col-span-12 xl:col-span-8">
          <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] h-full flex flex-col backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[600px]">
            <div className="p-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
                  <Table className="w-4 h-4 text-orange-500" />
                  Master Sync Stream
                </h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Comparing against Supabase Global Index</span>
              </div>
              {results && (
                <button onClick={handleDownload} className="bg-white text-slate-950 hover:bg-orange-500 hover:text-white text-xs font-black uppercase tracking-tighter py-3 px-8 rounded-full flex items-center gap-2 transition-all shadow-2xl active:scale-95">
                  <Download className="w-4 h-4" />
                  Get Master File
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
               <AnimatePresence mode="wait">
                 {loading ? (
                   <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                     <div className="w-32 h-32 relative mb-10">
                        <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full animate-pulse" />
                        <div className="relative w-full h-full border-[6px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin shadow-2xl" />
                     </div>
                     <p className="text-2xl font-black text-white italic tracking-tighter mb-4 uppercase">Mastering Data Flow</p>
                     <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] animate-pulse">Synchronizing Entities</p>
                   </div>
                 ) : results ? (
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-950/50 border-b border-white/5">
                         <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Code</th>
                         <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Name</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                         <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Identity</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {results.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="p-8">
                             <div className="flex items-center gap-4">
                                <div className={`w-2 h-10 rounded-full ${item.matchedCode === '미매칭' ? 'bg-red-500' : 'bg-orange-500'}`} />
                                <span className={`text-sm font-black tracking-widest ${item.matchedCode === '미매칭' ? 'text-red-500' : 'text-white'}`}>
                                    {item.matchedCode}
                                </span>
                             </div>
                           </td>
                           <td className="p-8">
                             <div className="flex flex-col">
                               <span className="text-base font-bold text-slate-200 tracking-tight leading-none mb-2">{item.matchedName}</span>
                               <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-none italic">Original: {item.productName}</span>
                             </div>
                           </td>
                           <td className="p-6 text-center">
                             <span className="text-lg font-black text-orange-400 font-mono tracking-tighter">{item.qty}</span>
                           </td>
                           <td className="p-6 text-center">
                             <div className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl ${item.matchedCode !== '미매칭' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                {item.matchedCode !== '미매칭' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-10 grayscale">
                     <Search className="w-24 h-24 text-slate-500 mb-8" />
                     <p className="text-sm font-black text-slate-500 uppercase tracking-[0.5em] italic">Waiting for Master Stream</p>
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
