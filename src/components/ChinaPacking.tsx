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
  TrendingUp,
  X,
  RefreshCcw,
  Edit2,
  ArrowRightLeft,
  ShieldCheck,
  Settings,
  Plus
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
  boxNo: string;
  boxCount?: number;
  originSheet?: string;
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
  const [activeTab, setActiveTab] = useState<string>('');
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [shoeKeywords, setShoeKeywords] = useState<string[]>([]);
  const [clothingKeywords, setClothingKeywords] = useState<string[]>([]);
  const [newShoeKey, setNewShoeKey] = useState('');
  const [newClothingKey, setNewClothingKey] = useState('');

  React.useEffect(() => {
    const savedShoe = localStorage.getItem('india_shoe_keywords');
    const savedClothing = localStorage.getItem('india_clothing_keywords');
    if (savedShoe) setShoeKeywords(JSON.parse(savedShoe));
    else {
      const defaults = ['아쿠아슈즈', '아쿠아', '젤리슈즈', '샌들', '장화', '슬립온', '운동화', '구두', '부츠', '신발', 'SHOES', 'SHOE', 'SANDAL'];
      setShoeKeywords(defaults);
      localStorage.setItem('india_shoe_keywords', JSON.stringify(defaults));
    }
    if (savedClothing) setClothingKeywords(JSON.parse(savedClothing));
    else {
      const defaults = ['원피스', '세트', '티셔츠', '바지', '팬츠', '치마', '스커트', '재킷', '코트', '블라우스', '셔츠', '가디건', '후드', '레깅스', '의류', 'CLOTHING'];
      setClothingKeywords(defaults);
      localStorage.setItem('india_clothing_keywords', JSON.stringify(defaults));
    }
  }, []);

  const saveKeywords = (type: 'shoe' | 'clothing', list: string[]) => {
    if (type === 'shoe') { setShoeKeywords(list); localStorage.setItem('india_shoe_keywords', JSON.stringify(list)); }
    else { setClothingKeywords(list); localStorage.setItem('india_clothing_keywords', JSON.stringify(list)); }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const generateAndDownload = async (items: PackingItem[], originalName: string) => {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const cleanFileName = originalName.replace(/\.[^/.]+$/, "");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('중국매칭결과');
    
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
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } };

    items.forEach(item => worksheet.addRow({ ...item, memo: `${dateStr}_${cleanFileName}_중국 패킹 입고` }));
    worksheet.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${dateStr}_${cleanFileName}_매칭완료.xlsx`);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      let clientExtractedData: any[] = [];
      const targetSheets = workbook.SheetNames.filter(name => name.includes('OZ') || name.includes('OH') || name.includes('매칭') || name.includes('오즈'));
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : [workbook.SheetNames[0]];

      sheetsToProcess.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length === 0) return;

        const headerRowInfos: any[] = [];
        jsonData.forEach((row, idx) => {
          if (!Array.isArray(row)) return;
          const rowStr = row.join('|');
          if (rowStr.includes('품명') && (rowStr.includes('합계') || rowStr.includes('수량'))) {
            let globalBoxCol = -1;
            row.forEach((cell, cellIdx) => {
                const c = String(cell || "").trim().toUpperCase();
                if (c.includes('NO') || c.includes('박스') || c.includes('번호') || c.includes('PACKING')) {
                    if (globalBoxCol === -1) globalBoxCol = cellIdx;
                }
            });

            const nameCols: number[] = [];
            row.forEach((cell, cellIdx) => {
                if (String(cell || "").trim() === '품명') nameCols.push(cellIdx);
            });

            const tables = nameCols.map((nCol, tIdx) => {
                let colorCol = -1, totalCol = -1, sizeStartCol = -1, ctCol = -1;
                const endLimit = nameCols[tIdx + 1] || row.length;
                for (let i = nCol + 1; i < endLimit; i++) {
                    const c = String(row[i] || "").trim().toUpperCase();
                    if (c === '칼라' || c === '색상') colorCol = i;
                    else if (c.includes('합계') || c.includes('수량')) totalCol = i;
                    else if (c === 'C/T' || c.includes('박스수')) ctCol = i;
                    else if (c === '사이즈') sizeStartCol = i;
                }
                
                let isMatrix = false;
                const nextRow = jsonData[idx + 1] || [];
                for (let i = (sizeStartCol !== -1 ? sizeStartCol : colorCol + 1); i < endLimit; i++) {
                    if (i === totalCol) continue;
                    if (String(row[i]).match(/[0-9]/) || String(nextRow[i]).match(/[0-9]/)) {
                        sizeStartCol = i; isMatrix = true; break;
                    }
                }
                return { nCol, colorCol, totalCol, sizeStartCol, ctCol, isMatrix };
            });

            headerRowInfos.push({ rowIdx: idx, globalBoxCol, tables });
          }
        });

        headerRowInfos.forEach((headerInfo, hIdx) => {
          let lastBoxNo = "";
          let currentGlobalBoxEnd = 0;
          const nextHeaderRowIdx = headerRowInfos[hIdx + 1] ? headerRowInfos[hIdx + 1].rowIdx : jsonData.length;
          
          for (let rIdx = headerInfo.rowIdx + 1; rIdx < nextHeaderRowIdx; rIdx++) {
            const row = jsonData[rIdx];
            if (!row || row.length === 0) {
              if (!jsonData.slice(rIdx + 1, rIdx + 500).some(nr => nr && nr.length > 0)) continue;
              continue;
            }

            let boxNo = headerInfo.globalBoxCol !== -1 ? String(row[headerInfo.globalBoxCol] || "").trim() : "";
            // Sub-tables might have their own Box Count (CT)
            // We use the FIRST table's CT if global boxNo is missing
            const firstTableCt = headerInfo.tables[0].ctCol !== -1 ? (parseInt(String(row[headerInfo.tables[0].ctCol] || "0").replace(/[^0-9]/g, '')) || 0) : 0;

            if (boxNo && boxNo.match(/[0-9]/)) {
                const parts = boxNo.split(/[-~.]/).map(p => parseInt(p.replace(/[^0-9]/g, ''))).filter(n => !isNaN(n));
                const end = parts[parts.length - 1] || parts[0] || 0;
                if (end > 0) currentGlobalBoxEnd = end;
                lastBoxNo = boxNo;
            } else if (firstTableCt > 0) {
                const start = currentGlobalBoxEnd + 1;
                const end = currentGlobalBoxEnd + firstTableCt;
                boxNo = start === end ? `${start}` : `${start}-${end}`;
                currentGlobalBoxEnd = end;
                lastBoxNo = boxNo;
            } else {
                boxNo = lastBoxNo;
            }

            headerInfo.tables.forEach((table: any) => {
                let name = String(row[table.nCol] || "").trim();
                if (!name || name.includes('합계') || name.includes('TOTAL') || name.includes('소계')) return;
                
                let color = String(row[table.colorCol] || "").trim();
                let boxCount = table.ctCol !== -1 ? (parseInt(String(row[table.ctCol] || "0").replace(/[^0-9]/g, '')) || 0) : 0;

                if (table.isMatrix) {
                    for (let sIdx = table.sizeStartCol; sIdx < (table.totalCol !== -1 ? table.totalCol : row.length); sIdx++) {
                        const val = parseInt(String(row[sIdx] || "0").replace(/[^0-9]/g, ''));
                        if (val > 0) {
                            let size = String(jsonData[headerInfo.rowIdx][sIdx] || jsonData[headerInfo.rowIdx+1][sIdx] || "").trim();
                            if (!size || size.includes('사이즈')) size = "FREE";
                            clientExtractedData.push({ style: name, name, color, size, qty: val, originSheet: sheetName, boxNo, boxCount });
                        }
                    }
                } else if (table.totalCol !== -1 || boxCount > 0) {
                    const qty = parseInt(String(row[table.totalCol] || "0").replace(/[^0-9]/g, '')) || 0;
                    if (qty > 0) clientExtractedData.push({ style: name, name, color, size: "FREE", qty, originSheet: sheetName, boxNo, boxCount });
                }
            });
          }
        });
      });

      if (clientExtractedData.length === 0) throw new Error("유효한 데이터를 찾지 못했습니다. 헤더 형식을 확인해 주세요.");
      const res = await fetch('/api/china/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: clientExtractedData, fileName: file.name }) });
      const data = await res.json();
      if (data.success) {
          setResults(data.items);
          const groups = Array.from(new Set(data.items.map((r: any) => (r.originSheet || '').includes('롤라루') ? '그로잉업' : '오즈키즈')));
          setActiveTab(groups.includes('오즈키즈') ? '오즈키즈' : (groups[0] || ''));
          setVerification({ originalTotal: data.originalTotal, matchedTotal: data.matchedTotal, fileName: data.fileName });
      }
    } catch (e: any) { console.error(e); alert(e.message || '처리 오류'); } finally { setLoading(false); }
  };

  const getSizeScore = (s: string) => {
    const v = s.toUpperCase();
    if (v.includes('XS')) return -2; if (v.includes('S')) return -1;
    if (v.includes('FREE') || v.includes('F')) return 0;
    if (v.includes('M')) return 500; if (v.includes('L')) return 600;
    const num = parseInt(v.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 999 : num;
  };

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/china/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.success) {
        let items = data.items;
        const tokens = val.trim().toUpperCase().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length > 0) {
          items = items.filter((it: any) => {
            const combined = `${it.matchedName} ${it.option} ${it.productCode}`.toUpperCase().replace(/\s/g, '');
            return tokens.every(token => combined.includes(token.replace(/\s/g, '')));
          });
        }
        setSearchResults(items.sort((a: any, b: any) => getSizeScore(a.option || "") - getSizeScore(b.option || "")));
      }
    } finally { setSearchLoading(false); }
  };

  const selectProduct = async (selectedItem: any) => {
    if (editingIndex === null || !results) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/china/search?q=${encodeURIComponent(selectedItem.matchedName)}`);
      const data = await res.json();
      const allOptions = data.success ? data.items : [selectedItem];
      const normalize = (s: string) => (s || "").replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
      const targetStyle = normalize(results[editingIndex].style);
      const newResults = [...results];
      newResults.forEach((resItem, idx) => {
        if (normalize(resItem.style) === targetStyle) {
            const resSize = normalize(resItem.size);
            const match = allOptions.find((opt: any) => normalize(opt.option).includes(resSize)) || selectedItem;
            newResults[idx] = { ...resItem, matchedCode: match.productCode, matchedName: match.matchedName };
        }
      });
      setResults(newResults); setIsModalOpen(false);
      fetch('/api/china/learn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalStyle: results[editingIndex].style, matchedName: selectedItem.matchedName, productCode: selectedItem.productCode, color: results[editingIndex].color, size: results[editingIndex].size }) }).then(() => alert(`AI 학습 완료`));
    } finally { setSearchLoading(false); }
  };

  const handlePrint = () => {
    if (!results) return;
    const currentItems = results.filter((r: any) => ((r.originSheet || '').includes('롤라루') ? '그로잉업' : '오즈키즈') === activeTab);
    if (currentItems.length === 0) { alert("데이터가 없습니다."); return; }

    const getCategory = (item: any) => {
        const name = (item.matchedName || "").toUpperCase();
        const style = (item.style || "").toUpperCase();
        if (shoeKeywords.some(k => name.includes(k.toUpperCase()) || style.includes(k.toUpperCase()))) return '신발';
        return '의류';
    };

    const boxMap = new Map<string, any>();
    currentItems.forEach(item => {
        const bNo = String(item.boxNo || "").trim();
        if (!bNo) return;
        if (!boxMap.has(bNo)) {
            const parts = bNo.split(/[-~.]/).map(p => parseInt(p.replace(/[^0-9]/g, ''))).filter(n => !isNaN(n));
            const start = parts[0] || 0;
            const end = parts[parts.length - 1] || start;
            boxMap.set(bNo, { boxNo: bNo, start, end, count: (end >= start ? end - start + 1 : 1), category: getCategory(item), items: [item] });
        } else { boxMap.get(bNo).items.push(item); }
    });

    const createPallets = (boxes: any[], capacity: number, categoryLabel: string) => {
        const pallets: any[] = [];
        let currentPalletItems: any[] = [];
        let currentCount = 0;
        const pushPallet = () => {
            if (currentPalletItems.length === 0) return;
            const first = currentPalletItems[0];
            const last = currentPalletItems[currentPalletItems.length - 1];
            pallets.push({ no: pallets.length + 1, category: categoryLabel, range: first.start === last.end ? `${first.start}` : `${first.start} ~ ${last.end}`, totalBox: currentCount, products: Array.from(new Set(currentPalletItems.flatMap(b => b.items.map((it: any) => (it.matchedName || "").split('-')[1] || it.matchedName)))).slice(0, 5).join(', ') });
            currentPalletItems = []; currentCount = 0;
        };
        boxes.forEach(box => {
            let remaining = box.count;
            let currentStart = box.start;
            while (remaining > 0) {
                const space = capacity - currentCount;
                if (space <= 0) { pushPallet(); continue; }
                const take = Math.min(remaining, space);
                const currentEnd = currentStart + take - 1;
                currentPalletItems.push({ ...box, start: currentStart, end: currentEnd, count: take });
                currentCount += take; currentStart += take; remaining -= take;
                if (currentCount === capacity) pushPallet();
            }
        });
        pushPallet(); return pallets;
    };

    const allBoxes = Array.from(boxMap.values()).sort((a, b) => a.start - b.start);
    const shoePallets = createPallets(allBoxes.filter(b => b.category === '신발'), 16, '신발');
    const clothingPallets = createPallets(allBoxes.filter(b => b.category === '의류'), 14, '의류');
    const allPallets = [...shoePallets, ...clothingPallets];

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const cleanFileName = (verification?.fileName || file?.name || '중국패킹').replace(/\.[^/.]+$/, "");
    printWindow.document.write(`
      <html>
        <head>
          <title>파레트 라벨 출력</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            body { font-family: 'Noto Sans KR', sans-serif; margin: 0; padding: 0; }
            .card { width: 210mm; height: 148mm; border: 8px solid black; margin: 10mm auto; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
            .header { font-size: 28px; font-weight: 900; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .range { font-size: 140px; font-weight: 900; text-align: center; flex: 1; display: flex; align-items: center; justify-content: center; }
            .footer { font-size: 22px; font-weight: 700; text-align: center; border-top: 5px solid black; padding-top: 20px; }
            @media print { .card { margin: 0; width: 100%; height: 98vh; } }
          </style>
        </head>
        <body>
          ${allPallets.map(p => `<div class="card"><div class="header">${cleanFileName}_${p.category} ${p.no}파레트</div><div class="range">${p.range}</div><div class="footer">${p.products}<br/><strong>(${p.totalBox} BOX)</strong></div></div>`).join('')}
          <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest border border-red-100">CATEGORY 2</div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><TrendingUp className="w-3 h-3 text-red-600" /> AI China Sync</div>
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-2">
          CHINA <span className="text-red-600">PACKING</span>
          <span className="text-[10px] font-normal text-gray-400 ml-2">v2026.05.13.1360</span>
        </h1>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           중국 제작 지시서를 AI가 실시간으로 교정하고 수량 정합성 검증을 마친 무결성 엑셀 파일을 생성합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 transition-all hover:shadow-2xl">
            <div 
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()} 
                className={`relative h-72 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                    isDragging ? 'border-red-500 bg-red-50/30' : file ? 'border-red-100 bg-red-50/10' : 'border-slate-100 bg-slate-50 hover:bg-red-50/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept=".xlsx,.xls" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${file ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border border-slate-100 text-slate-300'}`}>
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'Excel Loaded' : 'Upload China List'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 italic truncate max-w-full">{file ? file.name : 'OZ / OH Packing Excel'}</p>
              </div>
            </div>
            <button onClick={handleProcess} disabled={!file || loading} className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Sync China Data
            </button>
            {results && (
              <>
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => generateAndDownload(results.filter((r: any) => ((r.originSheet || '').includes('롤라루') ? '그로잉업' : '오즈키즈') === activeTab), verification?.fileName || '중국패킹')} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase">
                  <Download className="w-5 h-5" /> Download Final Excel
                </motion.button>
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={handlePrint} className="w-full mt-4 bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase">
                  <RefreshCcw className="w-5 h-5" /> Print Pallet Labels
                </motion.button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><TrendingUp className="w-4 h-4 text-red-600" /> China Production Stream</h3>
                {results && (
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
                    {Array.from(new Set(results.map((r: any) => (r.originSheet || '').includes('롤라루') ? '그로잉업' : '오즈키즈'))).map((tab: any) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab}</button>
                    ))}
                  </div>
                )}
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar">
                {loading ? (
                    <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-red-600" /><p className="text-xs font-black text-red-400 uppercase tracking-widest">Analyzing Factory Orders...</p></div>
                ) : results ? (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master SKU</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Matrix</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty / Box</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.filter((item: any) => ((item.originSheet || '').includes('롤라루') ? '그로잉업' : '오즈키즈') === activeTab).map((item: any, idx: number) => (
                          <tr key={idx} onClick={() => { setEditingIndex(results.indexOf(item)); setIsModalOpen(true); }} className="group hover:bg-red-50/50 transition-colors cursor-pointer">
                            <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-red-600">{item.matchedCode}</td>
                            <td className="p-6">
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase mb-1 block w-fit">REF: {item.style}</span>
                                <span className="text-sm font-bold text-slate-800 block">{item.matchedName}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase block italic group-hover:text-red-400">{item.size} / {item.color}</span>
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-slate-900">{item.qty}</span>
                                    <span className="text-[9px] text-slate-400 font-bold">Box: {item.boxNo}</span>
                                </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                ) : (
                    <div className="p-20 text-center opacity-20"><Table className="w-16 h-16 mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Awaiting Factory Feed</p></div>
                )}
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Manual SKU Override</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Precision Correction Engine</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8">
                <div className="relative mb-8">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" value={searchTerm} onChange={(e) => handleSearch(e.target.value)} placeholder="검색어 입력 (상품명, 상품코드...)" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold text-slate-700" />
                </div>
                <div className="max-h-[400px] overflow-auto custom-scrollbar pr-2">
                  {searchLoading ? (
                    <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-red-600" /></div>
                  ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {searchResults.map((it, i) => (
                        <button key={i} onClick={() => selectProduct(it)} className="w-full p-5 rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50/50 transition-all flex items-center justify-between group text-left">
                          <div>
                            <span className="text-[10px] font-black text-red-400 block mb-1">{it.productCode}</span>
                            <span className="text-sm font-bold text-slate-800 block">{it.matchedName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase italic">{it.option}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-all" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-slate-300 font-bold italic text-sm">No exact matches found</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Classification Engine Settings</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Smart Category Routing</p>
                </div>
                <button onClick={() => setIsSettingOpen(false)} className="w-10 h-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 grid grid-cols-2 gap-10">
                <div>
                  <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2 italic">Shoe Keywords (16 Box Cap)</h4>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newShoeKey} onChange={(e) => setNewShoeKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (saveKeywords('shoe', [...shoeKeywords, newShoeKey]), setNewShoeKey(''))} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-red-500 text-sm font-bold" placeholder="신규 키워드..." />
                    <button onClick={() => { if(newShoeKey) { saveKeywords('shoe', [...shoeKeywords, newShoeKey]); setNewShoeKey(''); } }} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all shadow-lg"><Plus className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-auto custom-scrollbar p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                    {shoeKeywords.map((k, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 flex items-center gap-2 group hover:border-red-200 hover:text-red-600 transition-all cursor-default">
                        {k} <X onClick={() => saveKeywords('shoe', shoeKeywords.filter((_, idx) => idx !== i))} className="w-3 h-3 cursor-pointer opacity-30 group-hover:opacity-100" />
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2 italic">Clothing Keywords (14 Box Cap)</h4>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newClothingKey} onChange={(e) => setNewClothingKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (saveKeywords('clothing', [...clothingKeywords, newClothingKey]), setNewClothingKey(''))} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-500 text-sm font-bold" placeholder="신규 키워드..." />
                    <button onClick={() => { if(newClothingKey) { saveKeywords('clothing', [...clothingKeywords, newClothingKey]); setNewClothingKey(''); } }} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all shadow-lg"><Plus className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-auto custom-scrollbar p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                    {clothingKeywords.map((k, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 flex items-center gap-2 group hover:border-slate-400 hover:text-slate-900 transition-all cursor-default">
                        {k} <X onClick={() => saveKeywords('clothing', clothingKeywords.filter((_, idx) => idx !== i))} className="w-3 h-3 cursor-pointer opacity-30 group-hover:opacity-100" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
