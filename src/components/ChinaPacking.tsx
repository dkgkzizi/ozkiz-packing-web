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
  FileSpreadsheet,
  AlertCircle,
  Flag,
  ArrowRightLeft,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type PackingItem = {
  matchedCode: string;
  matchedName: string;
  color: string;
  size: string;
  qty: number;
  pdfQty: number;
};

type VerificationData = {
  originalTotal: number;
  matchedTotal: number;
  fileName: string;
};

export default function ChinaPacking() {
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
    const worksheet = workbook.addWorksheet('중국매칭결과');
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
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } }; // Signature China Red

    items.forEach(item => worksheet.addRow({ ...item, memo: `${dateStr}_중국 입고` }));
    
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
      const res = await fetch('/api/china/convert', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
          setResults(data.items);
          setVerification({
              originalTotal: data.originalTotal,
              matchedTotal: data.matchedTotal,
              fileName: data.fileName
          });
          await generateAndDownload(data.items, data.fileName);
      } else {
          alert(`작업 실패: ${data.message}`);
      }
    } catch (e) { 
      console.error(e);
      alert('서버 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'); 
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest border border-red-100">
            CATEGORY 2
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <TrendingUp className="w-3 h-3 text-red-600" /> AI China Sync
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">
          China <span className="text-red-600">Packing</span>
        </h2>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           중국 제작 사진의 오타를 AI가 실시간으로 교정하고 <br />
           <span className="text-red-600 font-black">수량 정합성 검증</span>을 마친 무결점 엑셀 파일을 생성합니다.
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
                    isDragging ? 'border-red-500 bg-red-50' : 
                    file ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept="image/*,application/pdf" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'Image Secured' : 'Upload China List'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 italic truncate max-w-full">
                    {file ? file.name : 'AI Vision Processing On'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase font-black"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              AI Verification Start
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 h-full max-h-[calc(100vh-200px)]">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden">
             {/*Verification Summary Card*/}
             {verification && (
               <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="m-6 p-6 bg-red-50/30 rounded-[2rem] border border-red-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-red-50">
                        <ArrowRightLeft className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">AI Audit Integrity</h4>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Pre-Correction</p>
                                <p className="text-xl font-black text-slate-900">{verification.originalTotal}</p>
                            </div>
                            <div className="w-px h-8 bg-red-200/50" />
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-red-400 uppercase mb-0.5">Post-Match Sum</p>
                                <p className="text-xl font-black text-red-600">{verification.matchedTotal}</p>
                            </div>
                        </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-2 justify-end mb-1 ${verification.originalTotal === verification.matchedTotal ? 'text-green-600' : 'text-red-500'}`}>
                        {verification.originalTotal === verification.matchedTotal ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">AI Logic Passed</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">Review Needed</span>
                            </>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic tracking-tight">Dynamic Naming Triggered</p>
                  </div>
               </motion.div>
             )}

             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  China Audit Analytics
                </h3>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-16 h-16 border-[4px] border-slate-100 border-t-red-600 rounded-full animate-spin mb-6" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse italic">AI Correcting Typos...</p>
                    </div>
                  ) : results ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white/100 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master SKU</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Corrected Name</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit flow</th>
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
                               <span className="text-[9px] text-red-400 font-bold uppercase block italic">{item.size} / {item.color}</span>
                            </td>
                            <td className="p-4 text-center">
                               <div className="flex items-center justify-center gap-3">
                                   <span className="text-[10px] font-bold text-slate-200 line-through">{item.pdfQty}</span>
                                   <ArrowRightLeft className="w-3 h-3 text-red-300" />
                                   <span className={`text-sm font-black ${item.pdfQty === item.qty ? 'text-red-600' : 'text-slate-500 underline'}`}>
                                       {item.qty}
                                   </span>
                               </div>
                            </td>
                            <td className="p-4 text-center">
                               {item.pdfQty === item.qty ? (
                                   <div className="bg-red-50 text-red-600 p-1.5 rounded-lg inline-block shadow-sm">
                                       <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                                   </div>
                               ) : (
                                   <div className="bg-red-50 text-red-400 p-1.5 rounded-lg inline-block">
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
                      <FileSpreadsheet className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting AI Production Data</p>
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
