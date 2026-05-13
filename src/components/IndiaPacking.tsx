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
  TrendingUp,
  Settings,
  X,
  RefreshCcw,
  Tag,
  Plus,
  Flag
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
  pdfQty: number;
  boxNo?: string;
  boxCount?: number;
  style?: string;
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

  // Keyword Settings State
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [shoeKeywords, setShoeKeywords] = useState<string[]>([]);
  const [clothingKeywords, setClothingKeywords] = useState<string[]>([]);
  const [newShoeKey, setNewShoeKey] = useState('');
  const [newClothingKey, setNewClothingKey] = useState('');

  // Load Keywords (Consistent with ChinaPacking)
  React.useEffect(() => {
    const savedShoe = localStorage.getItem('india_shoe_keywords');
    const savedClothing = localStorage.getItem('india_clothing_keywords');
    
    if (savedShoe) {
      setShoeKeywords(JSON.parse(savedShoe));
    } else {
      const defaults = ['아쿠아슈즈', '아쿠아', '젤리슈즈', '젤리', '샌들', '장화', '슬립온', '운동화', '구두', '부츠', '워커', '힐', '신발', 'SHOES', 'SHOE', 'SANDAL', 'JELLY'];
      setShoeKeywords(defaults);
      localStorage.setItem('india_shoe_keywords', JSON.stringify(defaults));
    }
    
    if (savedClothing) {
      setClothingKeywords(JSON.parse(savedClothing));
    } else {
      const defaults = ['원피스', '세트', '티셔츠', '바지', '팬츠', '치마', '스커트', '재킷', '코트', '블라우스', '셔츠', '가디건', '후드', '레깅스', '한복', '의류', 'CLOTHING'];
      setClothingKeywords(defaults);
      localStorage.setItem('india_clothing_keywords', JSON.stringify(defaults));
    }
  }, []);

  const saveKeywords = (type: 'shoe' | 'clothing', list: string[]) => {
    if (type === 'shoe') {
      setShoeKeywords(list);
      localStorage.setItem('india_shoe_keywords', JSON.stringify(list));
    } else {
      setClothingKeywords(list);
      localStorage.setItem('india_clothing_keywords', JSON.stringify(list));
    }
  };

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
      { header: '메모', key: 'memo', width: 25 },
      { header: '박스번호', key: 'boxNo', width: 15 },
      { header: '박스수', key: 'boxCount', width: 10 }
    ];

    const hRow = worksheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } };

    items.forEach(item => worksheet.addRow({ ...item, memo: `${dateStr}_인도 입고` }));
    
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
          // 자동으로 다운로드 실행
          generateAndDownload(data.items, data.fileName || '인도패킹');
      } else alert(data.message);
    } catch (e) { alert('처리 중 오류'); } finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!results) return;

    const getCategory = (item: any) => {
        const name = (item.matchedName || "").toUpperCase().trim();
        const style = (item.originalKey || item.style || "").toUpperCase().trim();
        
        if (shoeKeywords.some(key => name.includes(key.toUpperCase()) || style.includes(key.toUpperCase()))) return '신발';
        if (clothingKeywords.some(key => name.includes(key.toUpperCase()) || style.includes(key.toUpperCase()))) return '의류';
        
        return '의류'; 
    };

    // 1. 박스 단위 맵핑
    const boxMap = new Map<string, any>();
    results.forEach(item => {
        const bNo = String(item.boxNo || "").trim();
        if (!bNo) return;

        if (!boxMap.has(bNo)) {
            const parts = bNo.split(/[-~.]/).filter(p => p !== "").map(p => parseInt(p.replace(/[^0-9]/g, '').trim()));
            const start = parts[0] || 0;
            const end = parts[parts.length - 1] || start;
            let count = item.boxCount || (end - start + 1);
            if (count === 0 && start > 0) count = 1;

            boxMap.set(bNo, {
                boxNo: bNo,
                start,
                end,
                count,
                items: [item],
                category: getCategory(item)
            });
        } else {
            const entry = boxMap.get(bNo);
            entry.items.push(item);
            if (getCategory(item) === '신발') entry.category = '신발';
        }
    });

    const createPallets = (boxes: any[], boxesPerPallet: number, label: string) => {
        const pallets: any[] = [];
        let currentPalletItems: any[] = [];
        let currentPalletCount = 0;

        const pushPallet = () => {
            if (currentPalletItems.length === 0) return;
            const first = currentPalletItems[0];
            const last = currentPalletItems[currentPalletItems.length - 1];
            
            pallets.push({
                no: pallets.length + 1,
                range: first.start === last.end ? `${first.start}` : `${first.start} ~ ${last.end}`,
                totalBox: currentPalletCount,
                products: Array.from(new Set(currentPalletItems.flatMap(b => b.items.map((it: any) => {
                    const name = it.matchedName || "";
                    return name.split('-')[1] || name;
                })))).filter(n => n).slice(0, 5).join(', '),
                category: label
            });
            currentPalletItems = [];
            currentPalletCount = 0;
        };

        boxes.forEach(box => {
            let remainingBoxCount = box.count;
            let currentStart = box.start;

            while (remainingBoxCount > 0) {
                const spaceLeft = boxesPerPallet - currentPalletCount;
                if (spaceLeft <= 0) {
                    pushPallet();
                    continue;
                }

                const take = Math.min(remainingBoxCount, spaceLeft);
                const currentEnd = currentStart + take - 1;

                currentPalletItems.push({
                    ...box,
                    start: currentStart,
                    end: currentEnd,
                    count: take
                });

                currentPalletCount += take;
                currentStart += take;
                remainingBoxCount -= take;

                if (currentPalletCount === boxesPerPallet) {
                    pushPallet();
                }
            }
        });

        pushPallet();
        return pallets;
    };

    const allBoxes = Array.from(boxMap.values()).sort((a, b) => a.start - b.start);
    const shoeBoxes = allBoxes.filter(b => b.category === '신발');
    const clothingBoxes = allBoxes.filter(b => b.category === '의류');

    const shoePallets = createPallets(shoeBoxes, 16, '신발');
    const clothingPallets = createPallets(clothingBoxes, 14, '의류');
    const allPallets = [...shoePallets, ...clothingPallets];

    if (allPallets.length === 0) {
        alert("분석된 박스 정보가 없습니다. (PDF에 박스 번호가 명확하지 않을 수 있습니다)");
        return;
    }

    const cleanFileName = (verification?.fileName || file?.name || '인도패킹').replace(/\.[^/.]+$/, "");
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>파레트 라벨 출력</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            body { font-family: 'Noto Sans KR', sans-serif; margin: 0; padding: 0; background: white; }
            .pallet-card {
              width: 210mm;
              height: 148mm;
              border: 8px solid black;
              margin: 10mm auto;
              padding: 40px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-after: always;
              position: relative;
            }
            .header { font-size: 28px; font-weight: 900; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .range { 
                font-size: 140px; 
                font-weight: 900; 
                text-align: center; 
                flex: 1; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                letter-spacing: -2px;
            }
            .footer { 
                font-size: 22px; 
                font-weight: 700; 
                text-align: center; 
                border-top: 5px solid black;
                padding-top: 20px;
                line-height: 1.4;
            }
            @media print {
              body { margin: 0; }
              .pallet-card { margin: 0; border-width: 8px; width: 100%; height: 98vh; }
            }
          </style>
        </head>
        <body>
          ${allPallets.map(p => `
            <div class="pallet-card">
              <div class="header">${cleanFileName}_${p.category} ${p.no}파레트</div>
              <div class="range">${p.range}</div>
              <div class="footer">
                ${p.products}<br/>
                <strong>(${p.totalBox} BOX)</strong>
              </div>
            </div>
          `).join('')}
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 500); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
            CATEGORY 3
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Globe className="w-3 h-3 text-slate-900" /> Global Matcher Hub
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">
          India <span className="text-slate-400">Packing</span>
        </h2>
        <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm">
           인도 수입 리스트를 분석하고 <span className="text-slate-900 font-black">자체 상품 코드</span>와 1:1 매칭합니다. <br />
           글로벌 규격 데이터를 국내 시스템 환경에 최적화하여 변환합니다.
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
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept=".pdf" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileUp className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? 'File Selected' : 'Upload India PDF'}</h4>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-4 italic truncate max-w-full">
                    {file ? file.name : 'Drag and Drop File'}
                </p>
              </div>
            </div>

            <button 
                onClick={handleProcess} 
                disabled={!file || loading} 
                className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Process for India
            </button>

            {results && (
              <>
                <motion.button 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => generateAndDownload(results, verification?.fileName || '인도패킹')} 
                    className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-rose-200 flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase"
                >
                  <Download className="w-5 h-5" />
                  Download Matched Excel
                </motion.button>
                
                <motion.button 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handlePrint}
                    className="w-full mt-4 bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg italic uppercase"
                >
                  <RefreshCcw className="w-5 h-5" />
                  Print Pallet Labels
                </motion.button>
              </>
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
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matching Integrity Summary</h4>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Original Total</p>
                                <p className="text-xl font-black text-slate-900">{verification.originalTotal}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-slate-300 uppercase mb-0.5">Matched Total</p>
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
                                <span className="text-xs font-black uppercase italic tracking-tighter">Verification Check</span>
                            </>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic truncate max-w-[150px]">Security Protocol Active</p>
                  </div>
               </motion.div>
             )}

             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-900" />
                    Live Match Stream
                  </h3>
                  <button 
                    onClick={() => setIsSettingOpen(true)}
                    className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-100 group"
                    title="분류 키워드 설정"
                  >
                    <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                  </button>
                </div>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-16 h-16 border-[4px] border-slate-100 border-t-slate-900 rounded-full animate-spin mb-6" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse italic tracking-tighter">Synchronizing with Cloud DB...</p>
                    </div>
                  ) : results ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white/100 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matched SKU</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty flow</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Box No</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.map((item, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-rose-600 transition-colors">
                               {item.matchedCode}
                            </td>
                            <td className="p-6">
                               <span className="text-sm font-bold text-slate-800 block mb-1">{item.matchedName}</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase block italic">{item.size} / {item.color}</span>
                            </td>
                            <td className="p-4 text-center">
                               <div className="flex items-center justify-center gap-3">
                                   <span className="text-[10px] font-bold text-slate-200 line-through">{item.pdfQty}</span>
                                   <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                                   <span className="text-sm font-black text-slate-900">{item.qty}</span>
                               </div>
                            </td>
                            <td className="p-4 text-center">
                               <span className="text-xs font-bold text-slate-400">{item.boxNo || '-'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-slate-400 grayscale scale-[0.7] transition-all">
                      <Table className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Data Core Selection</p>
                    </div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>
      </div>

      {/* Keyword Settings Modal */}
      <AnimatePresence>
        {isSettingOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSettingOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100 p-3 rounded-2xl">
                    <Settings className="w-6 h-6 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">분류 키워드 설정</h3>
                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1">
                      ※ 상품명 전체가 아닌 &apos;아쿠아슈즈&apos;, &apos;원피스&apos; 등 분류 키워드만 입력하세요.
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsSettingOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-4 h-4 text-rose-500" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">신발 (Shoes) 키워드</h4>
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {shoeKeywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-2 shadow-sm hover:border-rose-300 transition-colors">
                          {kw}
                          <button onClick={() => saveKeywords('shoe', shoeKeywords.filter(k => k !== kw))} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" value={newShoeKey} onChange={(e) => setNewShoeKey(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter' && newShoeKey.trim()) { saveKeywords('shoe', [...shoeKeywords, newShoeKey.trim()]); setNewShoeKey(''); }}}
                        placeholder="새 신발 키워드 입력..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => { if(newShoeKey.trim()) { saveKeywords('shoe', [...shoeKeywords, newShoeKey.trim()]); setNewShoeKey(''); }}}
                      className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      추가
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-4 h-4 text-blue-500" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">의류 (Clothing) 키워드</h4>
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {clothingKeywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-2 shadow-sm hover:border-blue-300 transition-colors">
                          {kw}
                          <button onClick={() => saveKeywords('clothing', clothingKeywords.filter(k => k !== kw))} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" value={newClothingKey} onChange={(e) => setNewClothingKey(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter' && newClothingKey.trim()) { saveKeywords('clothing', [...clothingKeywords, newClothingKey.trim()]); setNewClothingKey(''); }}}
                        placeholder="새 의류 키워드 입력..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => { if(newClothingKey.trim()) { saveKeywords('clothing', [...clothingKeywords, newClothingKey.trim()]); setNewClothingKey(''); }}}
                      className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      추가
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsSettingOpen(false)}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                >
                  설정 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
