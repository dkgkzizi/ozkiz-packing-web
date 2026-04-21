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
  TrendingUp,
  X,
  RefreshCcw,
  Edit2,
  ArrowRightLeft,
  ShieldCheck
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

export default function ChinaPacking() {
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
    const worksheet = workbook.addWorksheet('以묎뎅留ㅼ묶寃곌낵');
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const cleanFileName = originalName.replace(/\.[^/.]+$/, "");
    let filePart = "";
    // ?뚯씪紐낆뿉??8?먮━ ?レ옄(?좎쭨) 李얘린 (?? 20260418)
    const dateMatch = cleanFileName.match(/[0-9]{8}/);
    if (dateMatch) {
      const fullDate = dateMatch[0];
      const shortDatePart = fullDate.substring(4); // 0418
      filePart = cleanFileName.replace(fullDate, shortDatePart);
    } else {
      filePart = cleanFileName;
    }

    const finalMemo = `${dateStr}_${filePart} 以묎뎅 ?⑦궧 ?낃퀬`;

    worksheet.columns = [
      { header: '?곹뭹肄붾뱶', key: 'matchedCode', width: 20 },
      { header: '?곹뭹紐?, key: 'matchedName', width: 40 },
      { header: '?됱긽', key: 'color', width: 15 },
      { header: '?ъ씠利?, key: 'size', width: 12 },
      { header: '?묒뾽?섎웾', key: 'qty', width: 15 },
      { header: '硫붾え', key: 'memo', width: 25 }
    ];

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } }; // Signature China Red

    items.forEach(item => worksheet.addRow({ ...item, memo: finalMemo }));
    
    worksheet.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${dateStr}_${cleanFileName}_留ㅼ묶?꾨즺.xlsx`);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setVerification(null);

    try {
      // 1. 釉뚮씪?곗??먯꽌 吏곸젒 ?묒? ?쎄린 (?⑸웾 ?ㅼ씠?댄듃 諛?OZ/OH ?뺣? ?ㅼ틪)
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      let clientExtractedData: any[] = [];
      const targetSheets = workbook.SheetNames.filter(name => 
          name.includes('OZ') || name.includes('OH') || name.includes('?ㅼ쫰') || name.includes('?ㅼ뿉?댁튂') || name.includes('留ㅼ묶')
      );
      // 留뚯빟 ?寃??쒗듃媛 ?놁쑝硫?2踰덉㎏ ?쒗듃(Index 1)瑜??곗꽑?쒖쐞濡??먭퀬, 洹멸쾬???놁쑝硫??꾩껜 ?쒗듃 泥섎━
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : 
                             (workbook.SheetNames.length >= 2 ? [workbook.SheetNames[1]] : workbook.SheetNames);

      sheetsToProcess.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (jsonData.length === 0) return;

          // 1. ?ㅻ뜑 ?꾩튂 李얘린 (?덈챸, 移쇰씪, ?⑷퀎 ?깆씠 ?ы븿????
          const headerRows: { rowIdx: number, nameCol: number, colorCol: number, totalCol: number, sizeStartCol: number }[] = [];
          
          jsonData.forEach((row, idx) => {
              if (!Array.isArray(row)) return;
              const rowStr = row.join('|');
              if (rowStr.includes('?덈챸') && (rowStr.includes('?⑷퀎') || rowStr.includes('?섎웾'))) {
                  let nameCol = -1, colorCol = -1, totalCol = -1, sizeStartCol = -1;
                  row.forEach((cell, cellIdx) => {
                      const c = String(cell || "").trim();
                      if (c === '?덈챸') nameCol = cellIdx;
                      else if (c === '移쇰씪' || c === '?됱긽') colorCol = cellIdx;
                      else if (c === '?⑷퀎' || c === '?뚭퀎' || c === '珥앷퀎') totalCol = cellIdx;
                      else if (c.includes('?ъ씠利?) && c.includes('?섎웾')) sizeStartCol = cellIdx;
                  });
                  // ?ъ씠利??섎웾 ?쒖옉 ?꾩튂媛 紐낆떆?섏? ?딆? 寃쎌슦 ?⑷퀎 ?ㅼ쓬 而щ읆遺???먯깋
                  if (sizeStartCol === -1 && totalCol !== -1) sizeStartCol = totalCol + 1;
                  
                  if (nameCol !== -1 && nameCol > 5) { // ?몃룄/援?궡? ?욎씠吏 ?딅룄濡??ㅻⅨ履??꾪몴(index > 5)留??寃잜똿
                      headerRows.push({ rowIdx: idx, nameCol, colorCol, totalCol, sizeStartCol });
                  }
              }
          });

          // 2. 媛??ㅻ뜑 ?꾨옒 ?곗씠??異붿텧
          headerRows.forEach(header => {
              let lastName = "";
              
              // ?ъ씠利??ㅻ뜑媛 ?ㅻ뜑??諛붾줈 ?꾨옒???덈뒗吏 ?뺤씤 (蹂묓빀 ?덉씠?꾩썐 ???
              const nextRow = jsonData[header.rowIdx + 1];
              const isTwoStepHeader = nextRow && nextRow.some(c => !isNaN(parseInt(String(c))));
              const sizeHeaderRowIdx = isTwoStepHeader ? header.rowIdx + 1 : header.rowIdx;
              const dataStartRowIdx = isTwoStepHeader ? header.rowIdx + 2 : header.rowIdx + 1;

              for (let rIdx = dataStartRowIdx; rIdx < jsonData.length; rIdx++) {
                  const row = jsonData[rIdx];
                  if (!row || !Array.isArray(row)) break;
                  
                  let currentName = String(row[header.nameCol] || "").trim();
                  
                  // ?뱀뀡 醫낅즺 議곌굔 (鍮꾧퀬, ?⑷퀎, ?뱀? ?꾩쟾??鍮???
                  if (currentName.includes('鍮꾧퀬') || currentName === '?⑷퀎' || currentName === 'TOTAL') break;
                  const rowStr = row.slice(header.nameCol, header.nameCol + 10).join('').trim();
                  if (!rowStr && !currentName) break; 

                  // 蹂묓빀??紐낆묶 ?몃뱾留?                  if (!currentName && lastName) {
                      currentName = lastName;
                  } else if (currentName) {
                      lastName = currentName;
                  }

                  if (!currentName) continue;
                  
                  const color = String(row[header.colorCol] || "").trim();
                  const totalQty = parseInt(String(row[header.totalCol] || "0").replace(/[^0-9]/g, '')) || 0;
                  
                  if (totalQty > 0) {
                      let foundSizes = false;
                      for (let sIdx = header.sizeStartCol; sIdx < row.length; sIdx++) {
                          const sVal = parseInt(String(row[sIdx] || "0").replace(/[^0-9]/g, ''));
                          if (sVal > 0) {
                              // ?щ컮瑜??됱뿉???ъ씠利?紐낆묶 媛?몄삤湲?                              let sHeader = String(jsonData[sizeHeaderRowIdx]?.[sIdx] || "").trim();
                              if (!sHeader || sHeader.includes('?ъ씠利?)) sHeader = "FREE";
                              
                              clientExtractedData.push({ 
                                  style: currentName, 
                                  name: currentName, 
                                  color: color, 
                                  size: sHeader, 
                                  qty: sVal 
                              });
                              foundSizes = true;
                          }
                      }
                      
                      if (!foundSizes && totalQty > 0) {
                          clientExtractedData.push({ 
                              style: currentName, 
                              name: currentName, 
                              color: color, 
                              size: "FREE", 
                              qty: totalQty 
                          });
                      }
                  }
              }
          });
      });

      if (clientExtractedData.length === 0) {
          throw new Error("?묒? ?뚯씪??OZ/OH ??뿉???좏슚??留ㅼ묶 ?곗씠?곕? 李얠? 紐삵뻽?듬땲??");
      }

      const res = await fetch('/api/china/convert', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: clientExtractedData, fileName: file.name })
      });
      
      let data;
      const text = await res.text();
      try {
          data = JSON.parse(text);
      } catch (e) {
          throw new Error(`?쒕쾭 ?묐떟 ?ㅻ쪟 (Status: ${res.status}). ?곗씠?곌? ?덈Т 諛⑸??섍굅???쒕쾭媛 ?묐떟?섏? ?딆뒿?덈떎.`);
      }
      
      if (data.success) {
          // ?꾩껜 由ъ뒪?몃? ?ㅽ??쇨낵 ?ъ씠利덈퀎濡??뺣젹?섏뿬 ?쒖떆
          const sortedResults = data.items.sort((a: any, b: any) => {
            if (a.style !== b.style) return a.style.localeCompare(b.style);
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            return getSizeScore(a.size) - getSizeScore(b.size);
          });
          
          setResults(sortedResults);
          setVerification({
              originalTotal: data.originalTotal,
              matchedTotal: data.matchedTotal,
              fileName: data.fileName
          });

          // ?ㅻ쭏??濡쒖쭅: 誘몃ℓ移??곹뭹???녾퀬 ?섎웾???꾨꼍???쇱튂?섎㈃ ?먮룞 ?ㅼ슫濡쒕뱶
          const hasUnmatched = data.items.some((item: any) => item.matchedCode === '誘몃ℓ移? || item.matchedCode === '肄붾뱶?꾨씫');
          const isQuantityMatched = data.originalTotal === data.matchedTotal;

          if (!hasUnmatched && isQuantityMatched) {
              await generateAndDownload(data.items, data.fileName);
          }
      } else {
          alert(`?묒뾽 ?ㅽ뙣: ${data.message}`);
      }
    } catch (e: any) { 
      console.error(e);
      alert(e.message || '泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'); 
    } finally { setLoading(false); }
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
        
        // **媛뺣젰???꾨줎?몄뿏???꾪꽣留?*: ?ъ슜?먭? 紐낆떆??紐⑤뱺 ?⑥뼱媛 ?ы븿??寃껊쭔 ?몄텧
        const tokens = val.trim().toUpperCase().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length > 0) {
          items = items.filter((it: any) => {
            const combined = `${it.matchedName} ${it.option} ${it.productCode}`.toUpperCase().replace(/\s/g, '');
            // 紐⑤뱺 ?좏겙???ы븿?섏뼱????            return tokens.every(token => {
              const t = token.replace(/\s/g, '');
              // 留뚯빟 ?좏겙??100~200 ?ъ씠???レ옄?쇰㈃(?ъ씠利덉씪 ?뺣쪧 ?믪쓬), 
              // ?⑥닚 ?ы븿???꾨땲???듭뀡 ?꾨뱶???대떦 ?レ옄媛 ?덈뒗吏 ???꾧꺽?섍쾶 泥댄겕
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
    
    // 1. ?꾩옱 ?섏젙?섎젮?????뺣낫 (?ㅽ???珥덉젙洹쒗솕)
    const normalize = (s: string) => s.replace(/[^a-zA-Z0-9媛-??/g, '').toUpperCase();
    const targetStyleNormalized = normalize(results[editingIndex].style);
    const newResults = [...results];

    // 2. 媛숈? ?ㅽ??쇱쓣 怨듭쑀?섎뒗 紐⑤뱺 ?됱쓣 ?ㅻ쭏?명븯寃??곗뇙 援먯젙
    newResults.forEach((resItem, idx) => {
      const currentStyleNormalized = normalize(resItem.style);
      
      if (currentStyleNormalized === targetStyleNormalized) {
        if (idx === editingIndex) {
          // **?듭떖**: 吏湲??대┃???됱? 臾댁“嫄??뺥솗???좏깮???꾩씠?쒖쑝濡??낅뜲?댄듃
          newResults[idx] = {
            ...resItem,
            matchedCode: selectedItem.productCode,
            matchedName: selectedItem.matchedName
          };
        } else {
          const resSize = resItem.size.replace(/\s/g, '').toUpperCase();
          const bestMatchOption = searchResults.find(opt => {
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

    // 3. ?뺣젹 ?곹깭 ?좎?
    const sortedResults = newResults.sort((a: any, b: any) => {
      if (a.style !== b.style) return a.style.localeCompare(b.style);
      if (a.color !== b.color) return a.color.localeCompare(b.color);
      return getSizeScore(a.size) - getSizeScore(b.size);
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
           以묎뎅 ?쒖옉 ?ъ쭊???ㅽ?瑜?AI媛 ?ㅼ떆媛꾩쑝濡?援먯젙?섍퀬 <br />
           <span className="text-red-600 font-black">?섎웾 ?뺥빀??寃利?/span>??留덉튇 臾닿껐???묒? ?뚯씪???앹꽦?⑸땲??
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
                    isDragging ? 'border-red-600 bg-red-50' : 
                    file ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept=".xlsx, .xls" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'Data Secured' : 'Upload China Excel'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 italic truncate max-w-full">
                    {file ? file.name : 'OZ/OH Sheet Detection Active'}
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

            {results && (
              <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => generateAndDownload(results, verification?.fileName || '以묎뎅?⑦궧')} 
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
                    <div className={`flex items-center gap-2 justify-end mb-1 ${verification.originalTotal === verification.matchedTotal ? 'text-green-600' : 'text-red-600'}`}>
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
                                <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-red-600 flex items-center gap-2">
                                   {item.matchedCode}
                                   <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </td>
                                <td className="p-6">
                                   <div className="mb-1.5 flex items-center gap-2">
                                       <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase tracking-tighter">REF: {item.style}</span>
                                   </div>
                                   <span className="text-sm font-bold text-slate-800 block mb-1 group-hover:text-red-600 transition-colors">{item.matchedName}</span>
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
                            </React.Fragment>
                          );
                        })}
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

      {/* Manual Selection Modal */}
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
                  <h3 className="text-xl font-black text-slate-900 italic uppercase">Manual Product Select</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    ?뺥솗???곹뭹紐낆쓣 寃?됲븯??留ㅼ묶 ?뺣낫瑜?援먯젙?섏꽭??                  </p>
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
                    placeholder="?곹뭹紐??먮뒗 ?곹뭹肄붾뱶瑜??낅젰?섏꽭??.."
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-red-600/20 transition-all outline-none"
                    autoFocus
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-red-600" />
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
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 italic">
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
                      <p className="text-sm font-bold text-slate-300">寃??寃곌낵媛 ?놁뒿?덈떎.</p>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <AlertCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-300">寃?됱뼱瑜??낅젰?섏뿬 ?몃깽?좊━瑜??뺤씤?섏꽭??</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                   Powered by Anti-Gravity AI Matcher v4.2
                 </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
