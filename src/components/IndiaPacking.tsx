'use client';

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  ChevronRight, 
  Download, 
  Loader2,
  Table,
  Search,
  CheckCircle2,
  FileText,
  AlertCircle,
  Globe,
  ArrowRightLeft,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type PackingItem = {
  originalKey: string;
  matchedCode: string;
  matchedName: string;
  color: string;
  size: string;
  qty: number;
  pdfQty: number; // 행 단위 원본 수량 추가
};

type VerificationData = {
  originalTotal: number;
  matchedTotal: number;
  fileName: string;
};

export default function IndiaPacking() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackingItem[] | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const generateAndDownload = async (items: PackingItem[], originalName: string) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('인도매칭결과');
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    worksheet.columns = [
      { header: '상품코드', key: 'matchedCode', width: 20 },
      { header: '상품명', key: 'matchedName', width: 40 },
      { header: '색상', key: 'color', width: 15 },
      { header: '사이즈', key: 'size', width: 12 },
      { header: '작업수량', key: 'qty', width: 15 },
      { header: '메모', key: 'memo', width: 25 }
    ];

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };

    items.forEach(item => worksheet.addRow({ ...item, memo: `${dateStr}_인도 수입` }));
    
    worksheet.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanFileName = originalName.replace(/\.[^/.]+$/, "");
    saveAs(new Blob([buffer]), `${dateStr}_${cleanFileName}_매칭완료.xlsx`);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setVerification(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/india/convert', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
          setResults(data.items);
          setVerification({
              originalTotal: data.originalTotal,
              matchedTotal: data.matchedTotal,
              fileName: data.fileName
          });
          await generateAndDownload(data.items, data.fileName);
      } else alert(data.message);
    } catch (e) { alert('처리 중 오류'); } finally { setLoading(false); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
            CATEGORY 3
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Globe className="w-3 h-3 text-blue-500" /> Global Logistics Sync
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">
          India <span className="text-blue-600">Packing</span>
        </h2>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           업무 신뢰도를 극대화하는 <span className="text-blue-600 font-black">행 단위 정밀 수량 대조 시스템</span>을 탑재했습니다. <br />
           PDF 원본과 엑셀 결과값이 실시간으로 상호 검증됩니다.
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
                    isDragging ? 'border-blue-500 bg-blue-50' : 
                    file ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept="application/pdf" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'Auditor Active' : 'Upload India PDF'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 italic truncate max-w-full">
                    {file ? file.name : 'Row-Level Precision Sync'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-slate-900 hover:bg-slate-800 disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              <span className="text-lg tracking-tighter uppercase font-black italic">Start Precision Audit</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden min-h-[500px]">
             {/*Verification Summary Card*/}
             {verification && (
               <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="m-6 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-50">
                        <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Integrity Balance</h4>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">PDF Sum</p>
                                <p className="text-xl font-black text-slate-900">{verification.originalTotal}</p>
                            </div>
                            <div className="w-px h-8 bg-blue-100" />
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Excel Sum</p>
                                <p className="text-xl font-black text-blue-600">{verification.matchedTotal}</p>
                            </div>
                        </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-2 justify-end mb-1 ${verification.originalTotal === verification.matchedTotal ? 'text-green-600' : 'text-red-500'}`}>
                        {verification.originalTotal === verification.matchedTotal ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">Verified</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">Variance!</span>
                            </>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Row Audit Completed</p>
                  </div>
               </motion.div>
             )}

             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Detailed Row Audit
                </h3>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-16 h-16 border-[4px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-6" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse italic">Auditing Every SKU...</p>
                    </div>
                  ) : results ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white/100 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Code</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matched Name</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty Audit (PDF ➔ EXCEL)</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.map((item, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="p-6 text-sm font-black text-slate-400 tracking-widest">
                               {item.matchedCode}
                            </td>
                            <td className="p-6">
                               <span className="text-sm font-bold text-slate-800 block mb-1">{item.matchedName}</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase block italic">{item.size} / {item.originalKey.split('|')[2]}</span>
                            </td>
                            <td className="p-4 text-center">
                               <div className="flex items-center justify-center gap-3">
                                   <span className="text-[10px] font-bold text-slate-300 line-through decoration-slate-200">{item.pdfQty}</span>
                                   <ArrowRightLeft className="w-3 h-3 text-blue-300" />
                                   <span className={`text-sm font-black ${item.pdfQty === item.qty ? 'text-blue-600' : 'text-red-500 underline underline-offset-4'}`}>
                                       {item.qty}
                                   </span>
                               </div>
                            </td>
                            <td className="p-4 text-center">
                               {item.pdfQty === item.qty ? (
                                   <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg inline-block shadow-sm shadow-blue-100">
                                       <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                                   </div>
                               ) : (
                                   <div className="bg-red-50 text-red-500 p-1.5 rounded-lg inline-block">
                                       <AlertCircle className="w-3.5 h-3.5" />
                                   </div>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-slate-400 grayscale scale-[0.7]">
                      <FileText className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Precision Feed</p>
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
