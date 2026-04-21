'use client';

import React, { useState, useRef } from 'react';
import { 
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
  TrendingUp,
  X,
  RefreshCcw,
  Edit2
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
  style: string;
};

type VerificationData = {
  originalTotal: number;
  matchedTotal: number;
  fileName: string;
};

export default function DomesticPacking() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackingItem[] | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Selection Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const generateAndDownload = async (items: PackingItem[], originalName: string) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Íµ?Ç¥Îß§Ïπ≠Í≤∞Í≥º');
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    worksheet.columns = [
      { header: '?ÅÌíàÏΩîÎìú', key: 'matchedCode', width: 20 },
      { header: '?ÅÌíàÎ™?, key: 'matchedName', width: 40 },
      { header: '?âÏÉÅ', key: 'color', width: 15 },
      { header: '?¨Ïù¥Ï¶?, key: 'size', width: 12 },
      { header: '?ëÏóÖ?òÎüâ', key: 'qty', width: 15 },
      { header: 'Î©îÎ™®', key: 'memo', width: 25 }
    ];

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } }; 

    items.forEach(item => worksheet.addRow({ ...item, memo: `${dateStr}_Íµ?Ç¥ ?ÖÍ≥†` }));
    
    worksheet.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanFileName = originalName.replace(/\.[^/.]+$/, "");
    saveAs(new Blob([buffer]), `${dateStr}_${cleanFileName}_Îß§Ïπ≠?ÑÎ£å.xlsx`);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setVerification(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/domestic/convert', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
          const sortedResult = data.items.sort((a: any, b: any) => {
            if (a.style !== b.style) return a.style.localeCompare(b.style);
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            return getSizeScore(a.size || "") - getSizeScore(b.size || "");
          });
          setResults(sortedResult);
          setVerification({
              originalTotal: data.originalTotal,
              matchedTotal: data.matchedTotal,
              fileName: data.fileName
          });
      } else alert(data.message);
    } catch (e) { alert('Ï≤òÎ¶¨ Ï§??§Î•ò'); } finally { setLoading(false); }
  };

  const getSizeScore = (sizeStr: string) => {
    const s = sizeStr.toUpperCase();
    if (s.includes('XS')) return -2;
    if (s.includes('S')) return -1;
    if (s.includes('FREE') || s.includes('F')) return 0;
    if (s.includes('M')) return 500;
    if (s.includes('L')) return 600;
    if (s.includes('XL')) return 700;
    const num = parseInt(s.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 999 : num;
  };

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/china/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.success) {
        let items = data.items;
        
        // **Í∞ïÎ†•???ÑÎ°†?∏Ïóî???ÑÌÑ∞Îß?*: ?¨Ïö©?êÍ? Î™ÖÏãú??Î™®Îì† ?®Ïñ¥Í∞Ä ?¨Ìï®??Í≤ÉÎßå ?∏Ï∂ú
        const tokens = val.trim().toUpperCase().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length > 0) {
          items = items.filter((it: any) => {
            const combined = `${it.matchedName} ${it.option} ${it.productCode}`.toUpperCase().replace(/\s/g, '');
            // Î™®Îì† ?†ÌÅ∞???¨Ìï®?òÏñ¥????            return tokens.every(token => {
              const t = token.replace(/\s/g, '');
              // ÎßåÏïΩ ?†ÌÅ∞??100~200 ?¨Ïù¥???´Ïûê?ºÎ©¥(?¨Ïù¥Ï¶àÏùº ?ïÎ•† ?íÏùå), 
              // ?®Ïàú ?¨Ìï®???ÑÎãà???µÏÖò ?ÑÎìú???¥Îãπ ?´ÏûêÍ∞Ä ?àÎäîÏßÄ ???ÑÍ≤©?òÍ≤å Ï≤¥ÌÅ¨
              if (/^[0-9]{3}$/.test(t)) {
                const opt = (it.option || "").toUpperCase();
                return opt.includes(t);
              }
              return combined.includes(t);
            });
          });
        }

        const sorted = items.sort((a: any, b: any) => {
          return getSizeScore(a.option || "") - getSizeScore(b.option || "");
        });
        setSearchResults(sorted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectProduct = (selectedItem: any) => {
    if (editingIndex === null || !results) return;
    
    // 1. ?ÑÏû¨ ?òÏ†ï?òÎ†§?????ïÎ≥¥ (?§Ì???Ï¥àÏ†ïÍ∑úÌôî: ?πÏàòÎ¨∏Ïûê/Í≥µÎ∞± ?úÍ±∞ Î∞??ÄÎ¨∏Ïûê??
    const normalize = (s: string) => s.replace(/[^a-zA-Z0-9Í∞Ä-??/g, '').toUpperCase();
    const targetStyleNormalized = normalize(results[editingIndex].style);
    const newResults = [...results];

    // 2. Í∞ôÏ? ?§Ì???Í∑∏Î£π??Í≥µÏú†?òÎäî ?âÎì§???∞ÏáÑ ÍµêÏ†ï
    newResults.forEach((resItem, idx) => {
      const currentStyleNormalized = normalize(resItem.style);
      
      if (currentStyleNormalized === targetStyleNormalized) {
        if (idx === editingIndex) {
          // **?µÏã¨**: ÏßÄÍ∏??¥Î¶≠??Î∞îÎ°ú Í∑??âÏ? ?¨Ïö©?êÍ? ?†ÌÉù???ÑÏù¥??selectedItem)?ºÎ°ú Î¨¥Ï°∞Í±??ïÌôï???ÖÎç∞?¥Ìä∏
          newResults[idx] = {
            ...resItem,
            matchedCode: selectedItem.productCode,
            matchedName: selectedItem.matchedName
            // ?òÎèô ?†ÌÉù ???¨Ïù¥Ï¶??âÏÉÅ?Ä ?∏Î≤§?†Î¶¨ ?ïÎ≥¥Í∞Ä ???ïÌôï?òÎ?Î°??¨Í∏∞??ÍµêÏ†ï Í∞Ä?•Ìïò?? 
            // ?ÑÏû¨ ?îÍµ¨?¨Ìï≠?Ä ?òÎüâ/?¨Ïù¥Ï¶??†Ï??¥Î?Î°?ÏΩîÎìú?Ä ?ÅÌíàÎ™ÖÎßå ?ÖÎç∞?¥Ìä∏
          };
        } else {
          // Í∞ôÏ? Í∑∏Î£π???§Î•∏ ?âÎì§?Ä Í≤Ä??Í≤∞Í≥º Î¶¨Ïä§?∏Ïóê???ÅÏ†à???¨Ïù¥Ï¶àÎ? Ï∞æÏïÑ Îß§Ïπ≠
          const resSize = resItem.size.replace(/\s/g, '').toUpperCase();
          const resColor = resItem.color.replace(/\s/g, '').toUpperCase();

          const bestMatchOption = searchResults.find(opt => {
            const optRaw = (opt.option || "").replace(/\s/g, '').toUpperCase();
            return optRaw.includes(resSize) && (resColor === "" || optRaw.includes(resColor));
          }) || searchResults.find(opt => {
            const optRaw = (opt.option || "").replace(/\s/g, '').toUpperCase();
            return optRaw.includes(resSize);
          });

          if (bestMatchOption) {
            newResults[idx] = {
              ...resItem,
              matchedCode: bestMatchOption.productCode,
              matchedName: bestMatchOption.matchedName
            };
          }
        }
      }
    });

    // 3. ?ïÎ†¨ ?ÅÌÉú ?†Ï? (?âÏÉÅ -> ?¨Ïù¥Ï¶??úÏúºÎ°??êÎèô ?¨Ï†ï??
    const sortedResults = newResults.sort((a: any, b: any) => {
      if (a.style !== b.style) return a.style.localeCompare(b.style);
      if (a.color !== b.color) return a.color.localeCompare(b.color);
      return getSizeScore(a.size || "") - getSizeScore(b.size || "");
    });

    setResults(sortedResults);
    setIsModalOpen(false);
    setEditingIndex(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
            CATEGORY 1
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Flag className="w-3 h-3 text-slate-900" /> K-Logistics Hub
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">
          Domestic <span className="text-slate-400">Packing</span>
        </h2>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           Íµ?Ç¥ ?úÏ? ?ëÏãù???ïÎ? Î∂ÑÏÑù?òÍ≥† <span className="text-slate-900 font-black">?§ÏãúÍ∞??òÎüâ Í≤ÄÏ¶?/span> Í≤∞Í≥ºÎ•??úÍ≥µ?©Îãà?? <br />
           <span className="text-slate-900 font-black">?òÎèô ÍµêÏ†ï ?úÏä§??/span>???µÌï¥ Î™®Ìò∏???òÍ∏∞ ?∞Ïù¥?∞ÎèÑ 100% Î¨¥Í≤∞?±ÏùÑ Î≥¥Ïû•?©Îãà??
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
                    isDragging ? 'border-slate-900 bg-slate-50' : 
                    file ? 'border-slate-200 bg-slate-50/30' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'Data Loaded' : 'Upload Domestic List'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 italic truncate max-w-full">
                    {file ? file.name : 'PDF or High-Res Image'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase font-black"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Start Domestic Sync
            </button>

            {results && (
              <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => generateAndDownload(results, verification?.fileName || 'Íµ?Ç¥?®ÌÇπ')} 
                  className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase"
              >
                <Download className="w-5 h-5" />
                Download Final Excel
              </motion.button>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 h-full max-h-[calc(100vh-200px)]">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden">
             {verification && (
               <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="m-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
                        <ArrowRightLeft className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Domestic Integrity Summary</h4>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Raw Extract</p>
                                <p className="text-xl font-black text-slate-900">{verification.originalTotal}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-300 uppercase mb-0.5">Matched Sum</p>
                                <p className="text-xl font-black text-slate-900">{verification.matchedTotal}</p>
                            </div>
                        </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-2 justify-end mb-1 ${verification.originalTotal === verification.matchedTotal ? 'text-green-600' : 'text-slate-500'}`}>
                        {verification.originalTotal === verification.matchedTotal ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">Verified</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs font-black uppercase italic tracking-tighter">Variance Check</span>
                            </>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic truncate max-w-[150px]">Auto-Naming Active</p>
                  </div>
               </motion.div>
             )}

             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-900" />
                  K-Unit Audit Stream
                </h3>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-16 h-16 border-[4px] border-slate-100 border-t-slate-900 rounded-full animate-spin mb-6" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse italic tracking-tighter">Analyzing Domestic Patterns...</p>
                    </div>
                  ) : results ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white/100 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Code</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Reference</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit flow</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.map((item, idx) => {
                          const isNewGroup = idx > 0 && item.style !== results[idx - 1].style;
                          return (
                            <React.Fragment key={idx}>
                              {isNewGroup && (
                                <tr className="bg-slate-50/30">
                                  <td colSpan={4} className="h-2 border-t border-slate-100"></td>
                                </tr>
                              )}
                              <tr 
                                onClick={() => {
                                    setEditingIndex(idx);
                                    setSearchTerm('');
                                    setIsModalOpen(true);
                                    setSearchResults([]);
                                }}
                                className={`group hover:bg-red-50/50 transition-colors cursor-pointer ${isNewGroup ? 'border-t border-slate-200' : ''}`}
                              >
                                <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-red-600 transition-colors flex items-center gap-2">
                                   {item.matchedCode}
                                   <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </td>
                                <td className="p-6">
                                   <div className="mb-1.5 flex items-center gap-2">
                                       <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase tracking-tighter">REF: {item.style}</span>
                                   </div>
                                   <span className="text-sm font-bold text-slate-800 block mb-1 group-hover:text-red-900 transition-colors">{item.matchedName}</span>
                                   <span className="text-[9px] text-slate-400 font-bold uppercase block italic group-hover:text-red-400">{item.size} / {item.color}</span>
                                </td>
                                <td className="p-4 text-center">
                                   <div className="flex items-center justify-center gap-3">
                                       <span className="text-[10px] font-bold text-slate-200 line-through">{item.pdfQty}</span>
                                       <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                                       <span className={`text-sm font-black ${item.pdfQty === item.qty ? 'text-slate-900' : 'text-slate-500 underline'}`}>
                                           {item.qty}
                                       </span>
                                   </div>
                                </td>
                                <td className="p-4 text-center">
                                   {item.pdfQty === item.qty ? (
                                       <div className="bg-slate-50 text-slate-900 p-1.5 rounded-lg inline-block shadow-sm">
                                           <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                                       </div>
                                   ) : (
                                       <div className="bg-slate-50 text-slate-400 p-1.5 rounded-lg inline-block">
                                           <AlertCircle className="w-3.5 h-3.5" />
                                       </div>
                                   )}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-slate-400 grayscale scale-[0.7] transition-all">
                      <Table className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Domestic Task</p>
                    </div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>
      </div>

       <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 italic uppercase">Manual Code Correction</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    ?ïÌôï???ÅÌíà??Í≤Ä?âÌïò???òÍ∏∞ ?∞Ïù¥?∞Î? ÍµêÏ†ï?òÏÑ∏??                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8">
                <div className="relative mb-6">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-red-400" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="?ÅÌíàÎ™??êÎäî ?ÅÌíàÏΩîÎìúÎ•??ÖÎ†•?òÏÑ∏??.."
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-red-500/20 transition-all outline-none"
                    autoFocus
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-red-500" />
                  )}
                </div>

                <div className="max-h-[400px] overflow-auto custom-scrollbar pr-2">
                  {searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((item, idx) => (
                        <button 
                          key={idx}
                          onClick={() => selectProduct(item)}
                          className="w-full text-left p-5 rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50/30 transition-all group relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between relative z-10">
                            <div>
                              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 italic">
                                {item.productCode}
                              </p>
                              <h4 className="text-sm font-bold text-slate-800 group-hover:text-red-700 transition-colors">
                                {item.matchedName}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-bold mt-1">
                                {item.option}
                              </p>
                            </div>
                            <RefreshCcw className="w-5 h-5 text-slate-200 group-hover:text-red-400 group-hover:rotate-180 transition-all duration-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchTerm.length > 1 ? (
                    <div className="text-center py-20">
                      <Search className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-300">Í≤Ä??Í≤∞Í≥ºÍ∞Ä ?ÜÏäµ?àÎã§.</p>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <AlertCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-300">Í≤Ä?âÏñ¥Î•??ÖÎ†•?òÏó¨ ?∏Î≤§?†Î¶¨Î•??ïÏù∏?òÏÑ∏??</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                   Domestic Reconciliation System v2.0
                 </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
