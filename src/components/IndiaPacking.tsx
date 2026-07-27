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
  Flag,
  Edit2,
  Signature
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { stampSignatureAndDownload, stampSignatureOnElementAndDownload } from '@/lib/signature';

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
  verified?: boolean;
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
  const [signing, setSigning] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsPanelRef = useRef<HTMLDivElement>(null);

  // 마지막으로 사용한 서명 이름을 기억해뒀다가 다음에 기본값으로 채워준다.
  React.useEffect(() => {
    const saved = localStorage.getItem('signature_name');
    setSignerName(saved || 'David');
  }, []);

  // Manual Selection Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

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

  const handleAddSignature = async (name: string) => {
    if (!file) return;
    setSigning(true);
    try {
      if (file.type.startsWith('image/')) {
        await stampSignatureAndDownload(file, name);
      } else if (resultsPanelRef.current) {
        await stampSignatureOnElementAndDownload(resultsPanelRef.current, verification?.fileName || file.name, name);
      } else {
        throw new Error('PDF 파일은 먼저 데이터를 변환한 뒤에 서명을 추가할 수 있어요.');
      }
    } catch (e: any) {
      alert(e.message || '서명 추가 중 오류가 발생했습니다.');
    } finally {
      setSigning(false);
    }
  };

  const confirmSignature = () => {
    const name = signerName.trim() || 'David';
    localStorage.setItem('signature_name', name);
    setIsSignatureModalOpen(false);
    handleAddSignature(name);
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

  const getSizeScore = (sizeStr: string) => {
    const s = (sizeStr || '').toUpperCase();
    if (s.includes('XS')) return -2;
    if (s.includes('S')) return -1;
    if (s.includes('FREE') || s.includes('F')) return 0;
    if (s.includes('M')) return 500;
    if (s.includes('L')) return 600;
    if (s.includes('XL')) return 700;
    const num = parseInt(s.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 999 : num;
  };

  // 옵션 문자열(":라벤더, :100")에서 색상 부분만 뽑아 사이즈가 같을 때 정렬을 안정적으로 만든다
  const getOptionColor = (option: string) => {
    const parts = (option || '').split(',');
    return (parts[0] || '').trim().replace(/^:/, '');
  };

  // 인도 패킹리스트는 색상을 영어(IVORY 등)로 표기하는데 상품 DB엔 한글(아이보리)로만
  // 저장돼 있어서, 수동교정 그룹 일괄 적용 시 색상 비교가 항상 실패하고 사이즈만 보고
  // 엉뚱한 색상을 집어버리는 문제가 있었다. matcher.ts와 동일한 매핑으로 번역해서 비교한다.
  const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지'],
    'BLUE': ['블루', '파랑'],
    'NAVY': ['네이비', '남색'],
    'RED': ['레드', '빨강'],
    'GREEN': ['그린', '초록'],
    'MINT': ['민트'],
    'PURPLE': ['퍼플', '보라'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색']
  };

  // resColor(정규화 전, 예: "IVORY")에 대해 옵션 문자열에서 찾아볼 후보 색상 문자열 목록을 반환
  const getColorCandidates = (rawColor: string, normalize: (s: string) => string) => {
    const upper = (rawColor || '').trim().toUpperCase();
    if (!upper) return [];
    const synonyms = COLOR_MAP[upper];
    return [normalize(rawColor), ...(synonyms ? synonyms.map(normalize) : [])];
  };

  const handleSearch = (val: string) => {
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.length < 2) {
      setSearchResults([]);
      searchRequestIdRef.current++; // 대기 중이던 이전 요청들의 응답을 전부 무효화
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      // 이 요청만의 고유 번호 — 응답이 왔을 때 여전히 최신 요청인지 확인한다.
      const requestId = ++searchRequestIdRef.current;
      try {
        const res = await fetch(`/api/china/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (requestId !== searchRequestIdRef.current) return; // 이미 낡은 응답이면 무시

        if (data.success) {
          let items = data.items;

          const tokens = val.trim().toUpperCase().split(/\s+/).filter((t: string) => t.length > 0);
          if (tokens.length > 0) {
            items = items.filter((it: any) => {
              const combined = `${it.matchedName} ${it.option} ${it.productCode}`.toUpperCase().replace(/\s/g, '');
              return tokens.every((token: string) => {
                const t = token.replace(/\s/g, '');
                if (/^[0-9]{3}$/.test(t)) {
                  const opt = (it.option || '').toUpperCase();
                  return opt.includes(t) || combined.includes(t);
                }
                return combined.includes(t);
              });
            });
          }

          const sorted = items.sort((a: any, b: any) => {
            const colorDiff = getOptionColor(a.option || '').localeCompare(getOptionColor(b.option || ''), 'ko');
            if (colorDiff !== 0) return colorDiff;
            return getSizeScore(a.option || '') - getSizeScore(b.option || '');
          });
          setSearchResults(sorted);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (requestId === searchRequestIdRef.current) setSearchLoading(false);
      }
    }, 300);
  };

  const selectProduct = async (selectedItem: any) => {
    if (editingIndex === null || !results) return;

    setSearchLoading(true);
    try {
      // 선택된 상품명으로 전체 옵션(사이즈/색상 변형)을 다시 조회해서 같은 그룹을 한 번에 교정
      const res = await fetch(`/api/china/search?q=${encodeURIComponent(selectedItem.matchedName)}`);
      const data = await res.json();
      const allOptions = data.success ? data.items : [selectedItem];

      const normalize = (s: string) => (s || '').replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
      const targetKeyNormalized = normalize(results[editingIndex].originalKey || results[editingIndex].style || '');
      const newResults = [...results];

      newResults.forEach((resItem, idx) => {
        const currentKeyNormalized = normalize(resItem.originalKey || resItem.style || '');
        if (!targetKeyNormalized || currentKeyNormalized !== targetKeyNormalized) return;

        if (idx === editingIndex) {
          newResults[idx] = { ...resItem, matchedCode: selectedItem.productCode, matchedName: selectedItem.matchedName };
        } else {
          const resSize = normalize(resItem.size);
          const colorCandidates = getColorCandidates(resItem.color, normalize);

          let match = allOptions.find((opt: any) => {
            const optNorm = normalize(opt.option);
            const sizeMatch = optNorm.includes(resSize);
            const colorMatch = colorCandidates.length === 0 || colorCandidates.some(c => optNorm.includes(c));
            return sizeMatch && colorMatch;
          });
          // 사이즈만으로 재시도하되, 색상 정보가 있었는데 못 찾은 경우는 잘못된 색상을
          // 집어버리는 것보다 미매칭으로 남겨두는 편이 안전하므로 폴백하지 않는다.
          if (!match && colorCandidates.length === 0) {
            match = allOptions.find((opt: any) => normalize(opt.option).includes(resSize));
          }

          if (match) {
            newResults[idx] = { ...resItem, matchedCode: match.productCode, matchedName: match.matchedName };
          }
        }
      });

      setResults(newResults);
      setIsModalOpen(false);
      setEditingIndex(null);
      setSearchTerm('');
      setSearchResults([]);

      // AI 학습: 수동 매칭 결과를 저장해서 다음 동기화 때 자동으로 잡히게 함 (China와 동일 엔진 공유)
      if (results[editingIndex].originalKey) {
        fetch('/api/china/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalStyle: results[editingIndex].originalKey,
            matchedName: selectedItem.matchedName,
            productCode: selectedItem.productCode,
            color: results[editingIndex].color,
            size: results[editingIndex].size
          })
        }).catch(err => console.error('Learning failed:', err));
      }
    } catch (e) {
      console.error('Group selection error:', e);
      const fallbackResults = [...results];
      fallbackResults[editingIndex] = {
        ...fallbackResults[editingIndex],
        matchedCode: selectedItem.productCode,
        matchedName: selectedItem.matchedName
      };
      setResults(fallbackResults);
      setIsModalOpen(false);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div>
      <header className="mb-8 flex items-center gap-3">
        <div className="w-1.5 h-9 bg-slate-900 rounded-full" />
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">인도 패킹리스트</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            인도 수입 리스트를 분석해 자체 상품 코드와 1:1 매칭하고 수량을 검증합니다
          </p>
        </div>
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
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? '파일 선택됨' : '인도 PDF 업로드'}</h4>
                <p className="text-[11px] font-medium text-slate-400 px-4 truncate max-w-full">
                    {file ? file.name : '파일을 드래그하거나 클릭하세요'}
                </p>
              </div>
            </div>

            <button
                onClick={handleProcess}
                disabled={!file || loading}
                className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-base"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              인도 데이터 변환
            </button>

            {file && (
              <button
                  onClick={() => setIsSignatureModalOpen(true)}
                  disabled={signing || (!file.type.startsWith('image/') && !results)}
                  title={file.type.startsWith('image/') ? '업로드한 이미지에 서명을 추가해서 다운로드합니다' : (results ? '변환 결과 화면을 캡쳐해서 서명을 추가합니다' : 'PDF 파일은 먼저 데이터를 변환한 뒤 이용할 수 있어요')}
                  className="w-full mt-4 bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-700 font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 active:scale-95 text-base disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Signature className="w-5 h-5" />}
                서명 추가
              </button>
            )}

            <AnimatePresence>
              {isSignatureModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSignatureModalOpen(false)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm"
                  >
                    <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">서명 이름 입력</h3>
                    <p className="text-xs text-slate-400 font-medium mb-5">패킹리스트에 도장처럼 찍힐 이름을 입력하세요.</p>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmSignature(); }}
                      placeholder="예: David"
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-900 outline-none text-sm font-bold text-slate-800 mb-5"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsSignatureModalOpen(false)}
                        className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={confirmSignature}
                        className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors"
                      >
                        서명 추가
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {results && (
              <>
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => generateAndDownload(results, verification?.fileName || '인도패킹')}
                    className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-rose-200 flex items-center justify-center gap-3 active:scale-95 text-base"
                >
                  <Download className="w-5 h-5" />
                  매칭 엑셀 다운로드
                </motion.button>

                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handlePrint}
                    className="w-full mt-4 bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-base"
                >
                  <RefreshCcw className="w-5 h-5" />
                  파레트 라벨 출력
                </motion.button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 h-full max-h-[calc(100vh-200px)]">
          <div ref={resultsPanelRef} className="bg-white border border-slate-200 rounded-[2.5rem] h-full flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden">
             {verification && (() => {
                const isVerified = verification.originalTotal === verification.matchedTotal;
                return (
                  <div className="m-6 grid grid-cols-3 gap-3">
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400">원본 수량</p>
                        <p className="text-xl font-black text-slate-900">{verification.originalTotal}</p>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-slate-900" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400">매칭 수량</p>
                        <p className="text-xl font-black text-slate-900">{verification.matchedTotal}</p>
                      </div>
                    </div>
                    <div className={`p-5 rounded-2xl border flex items-center gap-3 ${isVerified ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                      {isVerified ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
                      <div>
                        <p className={`text-sm font-bold ${isVerified ? 'text-green-700' : 'text-amber-700'}`}>{isVerified ? '수량 일치' : '수량 확인 필요'}</p>
                        <p className="text-[11px] text-slate-400">{isVerified ? '정상적으로 검증됨' : '원본/매칭 수량이 달라요'}</p>
                      </div>
                    </div>
                  </div>
                );
             })()}

             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-900" />
                    변환 결과
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
                          <tr
                            key={idx}
                            onClick={() => {
                                setEditingIndex(idx);
                                setSearchTerm('');
                                setIsModalOpen(true);
                                setSearchResults([]);
                            }}
                            className="group hover:bg-rose-50/50 transition-colors cursor-pointer"
                          >
                            <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-rose-600 transition-colors flex items-center gap-2">
                               <span
                                 className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.verified ? 'bg-green-500' : 'bg-red-500'}`}
                                 title={item.verified ? '상품코드/상품명/색상/사이즈 DB 일치 확인됨' : 'DB와 완전히 일치하지 않음 — 확인 필요'}
                               />
                               {item.matchedCode}
                               <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </td>
                            <td className="p-6">
                               {(item.originalKey || item.style) && (
                                 <div className="mb-1.5 flex items-center gap-2">
                                     <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black rounded uppercase tracking-tighter">REF: {item.originalKey || item.style}</span>
                                 </div>
                               )}
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

      {/* Manual Match Correction Modal */}
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
                  <h3 className="text-xl font-black text-slate-900">수동 매칭 교정</h3>
                  <p className="text-xs font-medium text-slate-400">
                    정확한 상품을 검색하여 매칭 데이터를 교정하세요.
                  </p>
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
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="상품명 또는 상품코드를 입력하세요..."
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                    autoFocus
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-rose-500" />
                  )}
                </div>

                <div className="max-h-[400px] overflow-auto custom-scrollbar pr-2">
                  {searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectProduct(item)}
                          className="w-full text-left p-5 rounded-2xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 transition-all group relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between relative z-10">
                            <div>
                              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">
                                {item.productCode}
                              </p>
                              <h4 className="text-sm font-bold text-slate-800 group-hover:text-rose-700 transition-colors">
                                {item.matchedName}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-bold mt-1">
                                {item.option}
                              </p>
                            </div>
                            <RefreshCcw className="w-5 h-5 text-slate-200 group-hover:text-rose-400 group-hover:rotate-180 transition-all duration-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchTerm.length > 1 ? (
                    <div className="text-center py-20">
                      <Search className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-300">검색 결과가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <AlertCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-300">검색어를 입력하여 인벤토리를 확인하세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
