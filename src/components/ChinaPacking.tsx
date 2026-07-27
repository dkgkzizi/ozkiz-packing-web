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
  ShieldCheck,
  Settings,
  Tag,
  Plus,
  Signature
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { stampSignatureAndDownload, stampSignatureOnElementAndDownload } from '@/lib/signature';

type PackingItem = {
  matchedCode: string;
  matchedName: string;
  color: string;
  size: string;
  qty: number;
  pdfQty: number;
  style: string;
  boxNo?: string;
};

type VerificationData = {
  originalTotal: number;
  matchedTotal: number;
  fileName: string;
};

// 엑셀 컬럼 문자(A, Z, AA, AJ ...)를 0-based 인덱스로 변환
function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// 탭(시트)별로 신고 단가 확인용 컬럼 범위를 정의 — 이 범위는 사이즈/수량 매트릭스로
// 오인되지 않도록 파싱 전에 통째로 비워버린다. 파일/탭마다 원본 서식이 달라서
// 범위가 제각각이라 하드코딩된 매핑을 둔다.
const IGNORE_COLUMN_RULES: { match: (upper: string) => boolean; range: [string, string] }[] = [
  { match: (s) => s.includes('OZ') && s.includes('롤라루'), range: ['R', 'Z'] },
  { match: (s) => s.includes('OZ') && s.includes('오즈'), range: ['AB', 'AJ'] },
  { match: (s) => s.includes('OH') && s.includes('롤라루'), range: ['K', 'S'] },
  { match: (s) => s.includes('OH') && s.includes('오즈'), range: ['AD', 'AL'] },
];

function getIgnoreColumnRange(sheetName: string): [number, number] | null {
  const upper = (sheetName || '').toUpperCase();
  const rule = IGNORE_COLUMN_RULES.find(r => r.match(upper));
  return rule ? [colLetterToIndex(rule.range[0]), colLetterToIndex(rule.range[1])] : null;
}

export default function ChinaPacking() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackingItem[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [signing, setSigning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsPanelRef = useRef<HTMLDivElement>(null);

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
  
  const getChinaTabGroup = (sheetName: string) => {
      const s = (sheetName || '').toUpperCase();
      if (s.includes('롤라루')) return '그로잉업';
      if (s.includes('OZ') || s.includes('OH') || s.includes('오즈')) return '오즈키즈';
      return sheetName || '기본';
  };
  const [shoeKeywords, setShoeKeywords] = useState<string[]>([]);
  const [clothingKeywords, setClothingKeywords] = useState<string[]>([]);
  const [newShoeKey, setNewShoeKey] = useState('');
  const [newClothingKey, setNewClothingKey] = useState('');

  // Load/Save Keywords
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
    
    // "상의-비비아나(발레복)", "하의-블랙미니멀"처럼 구체적인 품목명 대신 "상의"/"하의"라는
    // 범용 접두어만 붙는 상품명이 있는데, 예전 기본 키워드 목록에는 이 범용 접두어가 빠져있어서
    // 명백한 의류 상품이 키워드 매�칭에 실패해 부자재로 잘못 분류되는 치명적인 문제가 있었다.
    // 이미 저장된(커스터마이징된) 목록에도 없으면 1회성으로 자동 추가해준다.
    const clothingMustHave = ['상의', '하의'];

    if (savedClothing) {
      let list = JSON.parse(savedClothing);
      const missing = clothingMustHave.filter(k => !list.includes(k));
      if (missing.length > 0) {
        list = [...list, ...missing];
        localStorage.setItem('india_clothing_keywords', JSON.stringify(list));
      }
      setClothingKeywords(list);
    } else {
      const defaults = ['원피스', '세트', '티셔츠', '바지', '팬츠', '치마', '스커트', '재킷', '코트', '블라우스', '셔츠', '가디건', '후드', '레깅스', '한복', '의류', ...clothingMustHave, 'CLOTHING'];
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

  const handleAddSignature = async () => {
    if (!file) return;
    setSigning(true);
    try {
      if (file.type.startsWith('image/')) {
        await stampSignatureAndDownload(file);
      } else if (resultsPanelRef.current) {
        await stampSignatureOnElementAndDownload(resultsPanelRef.current, verification?.fileName || file.name);
      } else {
        throw new Error('엑셀 파일은 먼저 데이터를 동기화한 뒤에 서명을 추가할 수 있어요.');
      }
    } catch (e: any) {
      alert(e.message || '서명 추가 중 오류가 발생했습니다.');
    } finally {
      setSigning(false);
    }
  };

  const generateAndDownload = async (items: PackingItem[], originalName: string) => {
    const cleanFileName = originalName.replace(/\.[^/.]+$/, "");
    let filePart = "";
    const dateMatch = cleanFileName.match(/[0-9]{8}/);
    if (dateMatch) {
      const fullDate = dateMatch[0];
      const shortDatePart = fullDate.substring(4); // 0418
      filePart = cleanFileName.replace(fullDate, shortDatePart);
    } else {
      filePart = cleanFileName;
    }
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');

    // 시트별(UI 그룹별)로 그룹화
    const groups: { [key: string]: PackingItem[] } = {};
    items.forEach(item => {
        const groupName = getChinaTabGroup((item as any).originSheet || '기본');
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
    });

    for (const sheetName of Object.keys(groups)) {
        const groupItems = groups[sheetName];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('중국매칭결과');
        
        // 탭 이름이 포함되도록 메모와 파일명 구성
        const sheetPrefix = sheetName !== '기본' ? `${sheetName}_` : '';
        const finalMemo = `${dateStr}_${filePart} ${sheetPrefix}중국 패킹 입고`;

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

        groupItems.forEach(item => worksheet.addRow({ ...item, memo: finalMemo }));
        
        worksheet.eachRow(row => {
            row.eachCell(cell => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        // 시트명이 있으면 파일명에도 반영
        const outFileName = sheetName !== '기본' ? `${dateStr}_${cleanFileName}_${sheetName}_매칭완료.xlsx` : `${dateStr}_${cleanFileName}_매칭완료.xlsx`;
        saveAs(new Blob([buffer]), outFileName);
        
        // 여러 파일을 받을 때 브라우저 딜레이를 주기 위해 약간 대기
        await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setVerification(null);

    try {
      // 1. 브라우저에서 직접 엑셀 읽기 (수량 데이터 및 OZ/OH 정보 추출)
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      let clientExtractedData: any[] = [];
      const targetSheets = workbook.SheetNames.filter(name => 
          name.includes('OZ') || name.includes('OH') || name.includes('오즈') || name.includes('오에이치') || name.includes('매칭')
      );
      // 만약 타겟 시트가 없으면 2번째 시트(Index 1)를 우선순위로 두고, 그것도 없으면 전체 시트 처리
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : 
                             (workbook.SheetNames.length >= 2 ? [workbook.SheetNames[1]] : workbook.SheetNames);

      sheetsToProcess.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (jsonData.length === 0) return;

          // 신고 단가 확인용 컬럼(사이즈/수량 매트릭스가 아님)은 파싱 전에 비워서
          // 사이즈 매트릭스로 잘못 인식되지 않게 한다.
          const ignoreRange = getIgnoreColumnRange(sheetName);
          if (ignoreRange) {
              const [ignoreStart, ignoreEnd] = ignoreRange;
              jsonData.forEach(row => {
                  if (!Array.isArray(row)) return;
                  for (let i = ignoreStart; i <= ignoreEnd; i++) {
                      row[i] = undefined;
                  }
              });
          }

          // 1. 헤더 위치 찾기 (품명, 칼라, 합계 등이 포함된 행)
          const headerRows: { rowIdx: number, nameCol: number, colorCol: number, totalCol: number, sizeStartCol: number, boxCol: number, ctCol: number }[] = [];
          // OH 포맷은 패킹 박스 표 오른쪽에 "제품사진/품명/칼라/합계/사이즈별수량" 참고용 표가
          // 같은 행에 나란히 붙어있는 경우가 있다. 그 참고표의 헤더 텍스트가 박스 표의 데이터 행과
          // 같은 행 배열에 섞여 들어오면(예: 4행) rowStr에 "품명"+"합계"가 우연히 다시 나타나서
          // 이를 반복되는 진짜 헤더로 오인하게 된다 — 그러면 그 지점부터 완전히 다른(박스번호 컬럼이
          // 없는) 참고표 컬럼을 데이터로 잘못 추출하게 된다. 첫 헤더에서 확정된 품명 컬럼 위치와
          // 다른 위치에서 발견된 "품명"은 반복 헤더로 인정하지 않아 이 문제를 막는다.
          let establishedNameCol = -1;

          jsonData.forEach((row, idx) => {
              if (!Array.isArray(row)) return;
              const rowStr = row.join('|');
              if (rowStr.includes('품명') && (rowStr.includes('합계') || rowStr.includes('수량'))) {
                  let nameCol = -1, colorCol = -1, totalCol = -1, subtotalCol = -1, sizeStartCol = -1, sizeEndCol = -1, boxCol = -1, ctCol = -1;
                  row.forEach((cell, cellIdx) => {
                      const c = String(cell || "").trim().toUpperCase();
                      // 품명/칼라는 첫 매치만 채택한다 — OH 포맷은 같은 행에 오른쪽으로
                      // "제품사진/품명/칼라/합계/사이즈별수량" 참고용 표가 나란히 붙어있어 "품명"/"칼라"가
                      // 한 행에 두 번 나타날 수 있는데, 나중 매치로 덮어쓰면 실제 박스 표의 컬럼
                      // 위치 대신 참고표의 컬럼 위치를 잡아버려 이후 데이터 추출 전체가 어긋난다.
                      if (c === '품명') { if (nameCol === -1) nameCol = cellIdx; }
                      else if (c === '칼라' || c === '색상') { if (colorCol === -1) colorCol = cellIdx; }
                      // "수량"/"포장수량"은 행별 실제 작업수량이라 항상 우선한다. "합계/소계/총계/총수량"은
                      // 병합된 소계 컬럼이라(OH 포맷처럼 같은 시트에 둘 다 있을 수 있음) 행별 수량이
                      // 없을 때만 대체로 사용한다 — 안 그러면 스캔 순서상 나중에 나오는 소계 컬럼이
                      // 앞서 찾은 행별 수량 컬럼을 덮어써서 병합 소계값을 모든 행에 잘못 적용하게 된다.
                      else if (c === '수량' || c === '포장수량') totalCol = cellIdx;
                      else if (c === '합계' || c === '소계' || c === '총계' || c === '총수량') { if (subtotalCol === -1) subtotalCol = cellIdx; }
                      else if (c === '사이즈') sizeStartCol = cellIdx;
                      else if (c.includes('NO') || c.includes('박스') || c.includes('번호') || c.includes('PACKING')) boxCol = cellIdx;
                      else if (c === 'C/T' || c.includes('박스수') || c.includes('BOX수') || c.includes('수량(BOX)')) ctCol = cellIdx;
                  });
                  if (totalCol === -1 && subtotalCol !== -1) totalCol = subtotalCol;

                  // 사이즈 매트릭스 레이아웃인지 판단 — "사이즈"라는 정확한 헤더 셀이 이미 발견됐다면
                  // (수직/단일 사이즈 레이아웃이라는 확실한 증거) 휴리스틱 탐지는 건너뛴다. 안 그러면
                  // C/T나 총수량 같은 다른 컬럼의 첫 데이터 행에 우연히 숫자가 있을 때 이를 사이즈
                  // 매트릭스로 오인해서 사이즈 시작 컬럼을 엉뚱한 곳으로 덮어써버리는 문제가 있었다.
                  let isMatrix = false;
                  let matrixSizeStart = -1;
                  const nextRow = jsonData[idx + 1] || [];

                  if (colorCol !== -1 && sizeStartCol === -1) {
                      for (let i = colorCol + 1; i < Math.max(row.length, nextRow.length); i++) {
                          if (i === totalCol) continue;
                          const hStr = String(row[i] || "").trim();
                          const nStr = String(nextRow[i] || "").trim();
                          if ((hStr.match(/[0-9]/) || nStr.match(/[0-9]/)) && !hStr.includes('수량') && !nStr.includes('수량')) {
                              matrixSizeStart = i;
                              isMatrix = true;
                              break;
                          }
                      }
                  }
                  
                  if (isMatrix) {
                      sizeStartCol = matrixSizeStart;
                      sizeEndCol = 200; // 충분히 큰 값
                      if (totalCol !== -1 && sizeStartCol < totalCol) {
                          sizeEndCol = totalCol - 1;
                      }
                  } else {
                      // 수직(단일) 사이즈 레이아웃
                      sizeEndCol = sizeStartCol;
                  }
                  
                  if (nameCol !== -1 && establishedNameCol !== -1 && nameCol !== establishedNameCol) {
                      // 이미 확정된 품명 컬럼과 다른 위치의 "품명" — 별도 참고표의 헤더가 우연히
                      // 섞여든 것이므로 반복 헤더로 인정하지 않는다.
                      return;
                  }

                  if (nameCol !== -1) {
                      if (establishedNameCol === -1) establishedNameCol = nameCol;
                      headerRows.push({ rowIdx: idx, nameCol, colorCol, totalCol, sizeStartCol, sizeEndCol, isMatrix, boxCol, ctCol } as any);
                  }
              }
          });

          // 2. 각 헤더 아래 데이터 추출
          headerRows.forEach((header: any, hIdx: number) => {
              let lastName = "";
              let lastColor = "";
              let lastBoxNo = "";
              let lastBoxCount = 0;
              
              // 사이즈 헤더가 헤더행 바로 아래에 있는지 확인 (매트릭스 레이아웃에서 "사이즈"
              // 텍스트 헤더 다음 행에 실제 사이즈 라벨(90,100,110...)이 나오는 경우 대응).
              // 수직(단일) 사이즈 레이아웃에서는 이 개념 자체가 성립하지 않는다 — 사이즈 컬럼이
              // 하나뿐이라 다음 행은 무조건 진짜 데이터이고, 그 사이즈 값 자체가 "130"처럼 숫자라서
              // 예전 로직은 이를 "사이즈 서브헤더 행"으로 착각해 첫 데이터 행을 통째로 건너뛰었다.
              const headerRowData = jsonData[header.rowIdx];
              const nextRow = jsonData[header.rowIdx + 1];
              const currentHeaderHasSizes = headerRowData.slice(header.sizeStartCol, header.sizeEndCol + 1).some((c: any) => String(c).match(/[0-9]/));
              const isTwoStepHeader = header.isMatrix && !currentHeaderHasSizes && nextRow && nextRow.slice(header.sizeStartCol, header.sizeEndCol + 1).some((c: any) => String(c).match(/[0-9]/));
              
              const sizeHeaderRowIdx = isTwoStepHeader ? header.rowIdx + 1 : header.rowIdx;
              const dataStartRowIdx = isTwoStepHeader ? header.rowIdx + 2 : header.rowIdx + 1;
              const nextHeaderRowIdx = hIdx + 1 < headerRows.length ? headerRows[hIdx + 1].rowIdx : jsonData.length;

              for (let rIdx = dataStartRowIdx; rIdx < nextHeaderRowIdx; rIdx++) {
                  const row = jsonData[rIdx];
                  if (!row || !Array.isArray(row)) break;
                  
                  // 다음 도표의 공식 헤더를 만나도 중단하지 않고 계속 수집 (데이터 유실 방지)
                  // 단, "품명"/"칼라"가 실제로 이 표의 품명/칼라 컬럼 위치에 있을 때만 반복 헤더로 인정한다.
                  // (오른쪽에 붙은 별도 참고표의 헤더 텍스트가 데이터 행에 우연히 섞여 들어와도
                  // 그건 다른 컬럼 위치이므로 잘못 걸러지지 않는다.)
                  if (rIdx > dataStartRowIdx &&
                      String(row[header.nameCol] || '').trim() === '품명' &&
                      String(row[header.colorCol] || '').trim() === '칼라') {
                      continue;
                  }

                  let currentName = String(row[header.nameCol] || "").trim();

                  // 섹션 종료 조건 대신 행 건너뛰기 로직으로 변경 (데이터 유실 방지)
                  // 이 표가 실제로 쓰는 컬럼 범위(품명~C/T 등) 안에서만 합계/총계 키워드를 검사한다.
                  // 행 전체를 검사하면 오른쪽에 붙은 별도 참고표(제품사진/품명/칼라/합계/사이즈별수량)의
                  // "합계" 헤더 텍스트 때문에 정상적인 박스 데이터 행이 합계 행으로 오인되어 유실된다.
                  const relevantCols = [header.nameCol, header.colorCol, header.totalCol, header.sizeStartCol, header.sizeEndCol, header.boxCol, header.ctCol].filter((c: number) => c !== -1 && c !== undefined);
                  const tableEndCol = relevantCols.length > 0 ? Math.max(...relevantCols) : row.length - 1;
                  const fullRowStr = row.slice(0, tableEndCol + 1).join('|');
                  // "추가신고수량:" 같은 통관 신고용 푸터 라벨 행은 "합계/총수량" 키워드에 걸리지
                  // 않아서(예: "신고총수량:"과 달리 "총수량"이라는 글자가 없음) 그냥 통과되면 직전
                  // 품명/박스번호가 그대로 승계되어 수량 0짜리 가짜 "미매칭" 항목이 생겨버린다.
                  if (fullRowStr.includes('합계') || fullRowStr.includes('TOTAL') || fullRowStr.includes('소계') || fullRowStr.includes('총계') || fullRowStr.includes('총수량') || fullRowStr.includes('신고')) {
                      continue;
                  }
                  
                  const rowStr = row.slice(header.nameCol, header.nameCol + 10).join('').trim();
                  if (!rowStr && !currentName) {
                      // 데이터 누락을 방지하기 위해 빈 행이 나와도 훨씬 더 깊게 탐색 (5 -> 500)
                      const hasMoreDataBelow = jsonData.slice(rIdx + 1, rIdx + 500).some(nr => nr && nr.join('').trim().length > 0);
                      if (!hasMoreDataBelow) break;
                      else continue;
                  }

                  let nameOriginal = String(row[header.nameCol] || "").trim();
                  let boxNoOriginal = header.boxCol !== -1 ? String(row[header.boxCol] || "").trim() : "";
                  let colorOriginal = String(row[header.colorCol] || "").trim();

                  // 합계 행 감지 강화: 명칭, 박스번호, 색상이 모두 없는데 수량만 있는 경우
                  if (!nameOriginal && !boxNoOriginal && !colorOriginal) {
                      const hasTotalQty = header.totalCol !== -1 && parseInt(String(row[header.totalCol] || "0").replace(/[^0-9]/g, '')) > 0;
                      const hasTotalCT = header.ctCol !== -1 && parseInt(String(row[header.ctCol] || "0").replace(/[^0-9]/g, '')) > 0;
                      if (hasTotalQty || hasTotalCT) continue; // 이것은 합계 행입니다.
                  }

                  currentName = nameOriginal;
                  if (!currentName && lastName) {
                      currentName = lastName;
                  } else if (currentName) {
                      if (currentName !== lastName) lastColor = "";
                      lastName = currentName;
                  }

                  if (!currentName) continue;
                  
                  let color = String(row[header.colorCol] || "").trim();
                  if (!color && lastColor) {
                      color = lastColor;
                  } else {
                      lastColor = color;
                  }
                  
                  let totalQty = header.totalCol !== -1 ? (parseInt(String(row[header.totalCol] || "0").replace(/[^0-9]/g, '')) || 0) : 0;
                  
                  let boxNoVal = header.boxCol !== -1 ? String(row[header.boxCol] || "").trim() : "";
                  // 병합된 패킹 번호 처리 (예: A열 "1", B열 "-", C열 "7")
                  if (header.boxCol !== -1 && boxNoVal) {
                      const nextCell1 = String(row[header.boxCol + 1] || "").trim();
                      const nextCell2 = String(row[header.boxCol + 2] || "").trim();
                      if (nextCell1 === '-' || nextCell1 === '~') {
                          boxNoVal += nextCell1 + nextCell2;
                      }
                  }
                  
                  if (!boxNoVal && lastBoxNo) {
                      boxNoVal = lastBoxNo;
                  } else if (boxNoVal) {
                      lastBoxNo = boxNoVal;
                  }
                  
                  let boxCountVal = header.ctCol !== -1 ? (parseInt(String(row[header.ctCol] || "0").replace(/[^0-9]/g, '')) || 0) : 0;
                  if (boxCountVal === 0 && lastBoxCount > 0 && !String(row[header.ctCol] || "").trim()) {
                      boxCountVal = lastBoxCount;
                  } else if (boxCountVal > 0) {
                      lastBoxCount = boxCountVal;
                  } else if (boxCountVal === 0 && !lastBoxCount) {
                      boxCountVal = 1; // 기본값
                  }

                  if (totalQty > 0 || boxNoVal) {
                      if (header.isMatrix) {
                          let foundSizes = false;
                          for (let sIdx = header.sizeStartCol; sIdx <= header.sizeEndCol; sIdx++) {
                              const sVal = parseInt(String(row[sIdx] || "0").replace(/[^0-9]/g, ''));
                              if (sVal > 0) {
                                  let sHeader = String(jsonData[sizeHeaderRowIdx]?.[sIdx] || "").trim();
                                  if (!sHeader || sHeader.includes('사이즈')) sHeader = "FREE";
                                  
                                  clientExtractedData.push({ 
                                      style: currentName, 
                                      name: currentName, 
                                      color: color, 
                                      size: sHeader, 
                                      qty: sVal,
                                      originSheet: sheetName,
                                      boxNo: boxNoVal,
                                      boxCount: boxCountVal
                                  });
                                  foundSizes = true;
                              }
                          }
                          
                          if (!foundSizes && (totalQty > 0 || boxNoVal)) {
                              clientExtractedData.push({ 
                                  style: currentName, 
                                  name: currentName, 
                                  color: color, 
                                  size: "FREE", 
                                  qty: totalQty,
                                  originSheet: sheetName,
                                  boxNo: boxNoVal,
                                  boxCount: boxCountVal
                              });
                          }
                      } else {
                          // 수직 레이아웃 (사이즈가 세로로 나열된 형태)
                          const sizeStr = header.sizeStartCol !== -1 ? String(row[header.sizeStartCol] || "FREE").trim() : "FREE";
                          // 수직 레이아웃일 때는 포장수량(총수량)을 수량으로 사용
                          clientExtractedData.push({ 
                              style: currentName, 
                              name: currentName, 
                              color: color, 
                              size: sizeStr, 
                              qty: totalQty,
                              originSheet: sheetName,
                              boxNo: boxNoVal,
                              boxCount: boxCountVal
                          });
                      }
                  }
              }
          });
      });

      if (clientExtractedData.length === 0) {
          throw new Error("엑셀 파일의 OZ/OH 탭에서 유효한 매칭 데이터를 찾지 못했습니다.");
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
          throw new Error(`서버 응답 오류 (Status: ${res.status}). 데이터가 너무 방대하거나 서버가 응답하지 않습니다.`);
      }
      
      if (data.success) {
          setResults(data.items);
          const groups = Array.from(new Set(data.items.map((r: any) => getChinaTabGroup(r.originSheet))));
          setActiveTab(groups.includes('오즈키즈') ? '오즈키즈' : (groups[0] || ''));
          
          setVerification({
              originalTotal: data.originalTotal,
              matchedTotal: data.matchedTotal,
              fileName: data.fileName
          });

          // 스마트 로직: 미매칭 상품이 없고 수량이 완벽히 일치하면 자동 다운로드
          const hasUnmatched = data.items.some((item: any) => item.matchedCode === '미매칭' || item.matchedCode === '코드누락' || item.matchedCode === '중복확인');
          const isQuantityMatched = data.originalTotal === data.matchedTotal;

          if (!hasUnmatched && isQuantityMatched) {
              await generateAndDownload(data.items, data.fileName);
          }
      } else {
          alert(`작업 실패: ${data.message}`);
      }
    } catch (e: any) { 
      console.error(e);
      alert(e.message || '처리 중 오류가 발생했습니다.'); 
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

  // 옵션 문자열(":라벤더, :100")에서 색상 부분만 뽑아 사이즈가 같을 때 정렬을 안정적으로 만든다
  const getOptionColor = (option: string) => {
    const parts = (option || '').split(',');
    return (parts[0] || '').trim().replace(/^:/, '');
  };

  // 패킹리스트가 색상을 영어(IVORY 등)로 표기하는 경우 상품 DB엔 한글(아이보리)로만
  // 저장돼 있어서 수동교정 그룹 일괄 적용 시 색상 비교가 실패할 수 있다.
  // matcher.ts와 동일한 매핑으로 번역해서 비교한다.
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
      // 이 요청만의 고유 번호 — 응답이 왔을 때 이게 여전히 최신 요청인지 확인한다.
      // (빠르게 타이핑하면 이전 글자에 대한 느린 응답이 나중에 도착해서 최신
      // 검색결과를 덮어쓰는 문제가 있었음)
      const requestId = ++searchRequestIdRef.current;
      try {
        const res = await fetch(`/api/china/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (requestId !== searchRequestIdRef.current) return; // 이미 낡은 응답이면 무시

        if (data.success) {
          let items = data.items;

          // **강력한 프론트엔드 필터링**: 사용자가 명시한 모든 단어가 포함된 것만 노출
          const tokens = val.trim().toUpperCase().split(/\s+/).filter(t => t.length > 0);
          if (tokens.length > 0) {
            items = items.filter((it: any) => {
              const combined = `${it.matchedName} ${it.option} ${it.productCode}`.toUpperCase().replace(/\s/g, '');
              // 모든 토큰이 포함되어야 함
              return tokens.every(token => {
                const t = token.replace(/\s/g, '');
                // 만약 토큰이 100~200 사이 숫자라면(사이즈일 확률 높음),
                // 단순 포함이 아니라 옵션 필드에 해당 숫자가 있는지 더 엄격하게 체크
                if (/^[0-9]{3}$/.test(t)) {
                  const opt = (it.option || "").toUpperCase();
                  // 옵션 필드에 있으면 우선 인정하되, 옵션이 비어있거나 다른 형식이라
                  // 못 찾는 경우를 대비해 상품명/코드 전체에서도 재확인한다 (검색결과가
                  // 통째로 사라지는 것을 방지).
                  return opt.includes(t) || combined.includes(t);
                }
                return combined.includes(t);
              });
            });
          }

          const sorted = items.sort((a: any, b: any) => {
            const colorDiff = getOptionColor(a.option || "").localeCompare(getOptionColor(b.option || ""), 'ko');
            if (colorDiff !== 0) return colorDiff;
            return getSizeScore(a.option || "") - getSizeScore(b.option || "");
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
      // 1. 선택된 상품의 상품명으로 모든 옵션 데이터를 다시 조회 (사이즈/색상 전체 확보)
      // 검색 필터링에 의해 누락된 다른 사이즈들을 찾기 위해 상품명으로 전체 재조회합니다.
      const res = await fetch(`/api/china/search?q=${encodeURIComponent(selectedItem.matchedName)}`);
      const data = await res.json();
      const allOptions = data.success ? data.items : [selectedItem];

      const normalize = (s: string) => (s || "").replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
      const targetStyleNormalized = normalize(results[editingIndex].style);
      const newResults = [...results];

      // 2. 같은 스타일(REF)을 공유하는 모든 행을 스마트하게 연쇄 교정
      newResults.forEach((resItem, idx) => {
        const currentStyleNormalized = normalize(resItem.style);
        
        if (currentStyleNormalized === targetStyleNormalized) {
          if (idx === editingIndex) {
            // 사용자가 직접 클릭한 행은 선택한 상품으로 즉시 업데이트
            newResults[idx] = {
              ...resItem,
              matchedCode: selectedItem.productCode,
              matchedName: selectedItem.matchedName
            };
          } else {
            // 같은 그룹 내 다른 사이즈/색상 행들도 지능적으로 매칭
            const resSize = normalize(resItem.size);
            const colorCandidates = getColorCandidates(resItem.color, normalize);

            // 우선순위 1: 색상과 사이즈가 모두 일치하는 옵션 찾기
            let match = allOptions.find((opt: any) => {
              const optNorm = normalize(opt.option);
              const sizeMatch = optNorm.includes(resSize);
              const colorMatch = colorCandidates.length === 0 || colorCandidates.some(c => optNorm.includes(c));
              return sizeMatch && colorMatch;
            });

            // 우선순위 2: 색상 정보가 애초에 없던 행만 사이즈 단독 매칭으로 재시도.
            // 색상이 있는데 못 찾은 경우 엉뚱한 색상을 집어버리는 것보다 그대로 두는 게 안전하다.
            if (!match && colorCandidates.length === 0) {
              match = allOptions.find((opt: any) => normalize(opt.option).includes(resSize));
            }

            if (match) {
              newResults[idx] = {
                ...resItem,
                matchedCode: match.productCode,
                matchedName: match.matchedName
              };
            }
          }
        }
      });

      // 3. 정렬 상태 유지하며 결과 반영
      const sortedResults = [...newResults].sort((a: any, b: any) => {
        if (a.style !== b.style) return a.style.localeCompare(b.style);
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return getSizeScore(a.size) - getSizeScore(b.size);
      });

      setResults(sortedResults);
      setIsModalOpen(false);
      setEditingIndex(null);
      setSearchTerm('');
      setSearchResults([]);

      // 4. AI 학습: 수동 매칭 결과를 DB에 저장하여 다음에 자동으로 잡도록 함
      // (UI 반응성을 위해 비동기로 호출하고 결과 대기는 하지 않음)
      fetch('/api/china/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalStyle: results[editingIndex].style,
          matchedName: selectedItem.matchedName,
          productCode: selectedItem.productCode,
          color: results[editingIndex].color,
          size: results[editingIndex].size
        })
      }).then(() => {
          alert(`AI 학습 완료: [${results[editingIndex].style}]의 매칭 정보를 저장했습니다.`);
      }).catch(err => console.error("Learning failed:", err));
    } catch (e) {
      console.error("Group selection error:", e);
      // 에러 발생 시 최소한 선택한 항목 하나라도 반영 (Fallback)
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

  const handlePrint = () => {
    if (!results) return;

    const currentItems = results.filter((r: any) => {
        const s = r.originSheet || '';
        return (s.includes('롤라루') ? '그로잉업' : '오즈키즈') === activeTab;
    });

    if (currentItems.length === 0) {
        alert("출력할 데이터가 없습니다.");
        return;
    }

    const getCategory = (item: any) => {
        const name = (item.matchedName || "").toUpperCase();
        const original = (item.style || "").toUpperCase();
        if (shoeKeywords.some(k => name.includes(k.toUpperCase()) || original.includes(k.toUpperCase()))) return '신발';
        if (clothingKeywords.some(k => name.includes(k.toUpperCase()) || original.includes(k.toUpperCase()))) return '의류';
        return '부자재';
    };

    const boxMap = new Map<string, any>();
    currentItems.forEach((item: any) => {
        const bNo = (item.boxNo || "").trim();
        if (!bNo) return;

        const parts = bNo.split(/[-~.]/).filter(p => p !== "").map(p => parseInt(p.replace(/[^0-9]/g, ''))).filter(n => !isNaN(n));
        const start = parts[0] || 0;
        const end = parts[parts.length - 1] || start;
        const count = (end >= start) ? (end - start + 1) : 1;

        if (!boxMap.has(bNo)) {
            // 한 박스 안에 서로 다른 카테고리의 상품이 혼적된 경우(예: 원피스-누아르 +
            // 우비-라이팅가드가 같은 박스에 들어있는 경우), 박스를 카테고리별로 쪼개서 같은
            // 박스 번호가 신발/의류 파레트에 걸쳐 중복으로 나오면 현장에서 헷갈린다. 그래서
            // 박스는 항상 하나의 카테고리로만 취급하고, 그 박스 안에서 정렬 순서상 가장 먼저
            // 나오는(원본 패킹리스트 행 순서상 위에 있는) 상품의 카테고리를 박스 전체의
            // 카테고리로 사용한다 — 이후 같은 박스의 다른 상품이 들어와도 카테고리는 바꾸지 않는다.
            const category = getCategory(item);
            boxMap.set(bNo, { boxNo: bNo, start, end, count, category, items: [item] });
        } else {
            boxMap.get(bNo).items.push(item);
        }
    });

    const allBoxes = Array.from(boxMap.values()).sort((a, b) => a.start - b.start);
    const shoeBoxes = allBoxes.filter(b => b.category === '신발');
    const clothingBoxes = allBoxes.filter(b => b.category === '의류');
    const materialBoxes = allBoxes.filter(b => b.category === '부자재');

    const pallets: any[] = [];

    // 한 파레트 안에 담긴 박스들의 번호를 "첫박스~끝박스"로 뭉뚱그려 표시하면, 그 사이 번호가
    // 다른 카테고리 파레트로 빠져서 실제로는 이 파레트에 없는데도 있는 것처럼 보여 헷갈린다
    // (예: 신발 박스가 22번, 64~68번뿐인데 "22~68"로 적으면 23~63번도 이 파레트에 있는 것처럼
    // 보임). 연속된 박스 구간만 각각 표시하고, 끊기는 지점은 쉼표로 구분한다 (예: "22, 64~68").
    const formatBoxRangeLabel = (boxesInPallet: any[]): string => {
        const runs: string[] = [];
        let runStart = boxesInPallet[0].start;
        let runEnd = boxesInPallet[0].end;
        for (let i = 1; i < boxesInPallet.length; i++) {
            const b = boxesInPallet[i];
            if (b.start === runEnd + 1) {
                runEnd = b.end;
            } else {
                runs.push(runStart === runEnd ? `${runStart}` : `${runStart} ~ ${runEnd}`);
                runStart = b.start;
                runEnd = b.end;
            }
        }
        runs.push(runStart === runEnd ? `${runStart}` : `${runStart} ~ ${runEnd}`);
        return runs.join(', ');
    };

    // 박스는 정렬 순서상 맨 위 상품의 카테고리로 분류되지만(위 boxMap 생성부 참고), 그 박스에
    // 실제로 섞여 들어있는 다른 카테고리 상품도 라벨에서 안 보이면 "왜 신발 상품이 의류 파레트에
    // 찍히지" 하고 헷갈릴 수 있다. 섞인 박스만 상품명을 "누아르/라이팅가드(혼합)"처럼 슬래시로
    // 묶어서 하나의 박스 안에 같이 들어있다는 걸 보여주고, 섞이지 않은 박스는 그대로 개별 표시한다.
    const buildProductsLabel = (boxesInPallet: any[], categoryLabel: string): string => {
        const labels = new Set<string>();
        boxesInPallet.forEach(box => {
            const namesInBox: string[] = [];
            const seenNames = new Set<string>();
            let isMixed = false;
            box.items.forEach((i: any) => {
                const n = i.matchedName || i.style;
                const base = n.split('-')[1] || n;
                if (getCategory(i) !== categoryLabel) isMixed = true;
                if (!seenNames.has(base)) { seenNames.add(base); namesInBox.push(base); }
            });
            if (isMixed && namesInBox.length > 1) {
                labels.add(`${namesInBox.join('/')}(혼합)`);
            } else {
                namesInBox.forEach(n => labels.add(n));
            }
        });
        return Array.from(labels).slice(0, 5).join(', ');
    };

    // 박스 번호 순서대로 끊김 없이 정확히 용량(capacity)만큼씩 채워나가고, 맨 마지막 파레트에만
    // 나머지가 남도록 한다. 패킹리스트 한 줄이 "144-173"처럼 하이픈 범위로 여러 박스를 한번에
    // 표기하거나, 앞 파레트가 용량을 다 못 채운 채로 다음 줄로 넘어가는 경우 둘 다, 그 줄을
    // 파레트 경계에서 필요한 만큼 쪼개어 이어붙인다 — 그래야 중간에 용량 미만인 파레트가
    // 생기지 않는다 (16,16,16... 쭉 채우다가 마지막에만 남는 만큼).
    const createPalletsInternal = (rawBoxes: any[], capacity: number, categoryLabel: string) => {
        let currentPalletBoxes: any[] = [];
        let currentCount = 0;
        let palletNum = 1;

        const flushPallet = () => {
            if (currentPalletBoxes.length === 0) return;
            pallets.push({
                no: palletNum,
                category: categoryLabel,
                range: formatBoxRangeLabel(currentPalletBoxes),
                products: buildProductsLabel(currentPalletBoxes, categoryLabel),
                totalBox: currentCount
            });
            palletNum++;
            currentPalletBoxes = [];
            currentCount = 0;
        };

        rawBoxes.forEach(box => {
            let cursor = box.start;
            let remaining = box.count;
            while (remaining > 0) {
                const spaceLeft = capacity - currentCount;
                const take = Math.min(spaceLeft, remaining);
                currentPalletBoxes.push({ ...box, start: cursor, end: cursor + take - 1, count: take });
                currentCount += take;
                cursor += take;
                remaining -= take;
                if (currentCount >= capacity) flushPallet();
            }
        });

        flushPallet();
    };

    createPalletsInternal(shoeBoxes, 16, "신발");
    createPalletsInternal(clothingBoxes, 14, "의류");
    // 부자재 박스 크기 기준은 별도로 안내받은 바 없어 의류(14박스/파레트)와 동일하게 적용한다.
    createPalletsInternal(materialBoxes, 14, "부자재");

    const allPallets = pallets;

    if (allPallets.length === 0) {
        alert("박스 정보가 부족하여 파레트를 생성할 수 없습니다.");
        return;
    }

    const cleanFileName = (verification?.fileName || file?.name || '중국패킹').replace(/\.[^/.]+$/, "");
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
              .no-print { display: none; }
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
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div>
      <header className="mb-8 flex items-center gap-3">
        <div className="w-1.5 h-9 bg-red-600 rounded-full" />
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">중국 패킹리스트</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            중국 제작 지시서를 상품 코드와 자동 매칭하고 수량 정합성을 검증합니다
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
                    isDragging ? 'border-red-500 bg-red-50/30' : 
                    file ? 'border-red-100 bg-red-50/10' : 'border-slate-100 bg-slate-50 hover:bg-red-50/50'
                }`}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} accept=".xlsx,.xls" />
              <div className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                  file ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border border-slate-100 text-slate-300'
                }`}>
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-slate-900 font-black text-base tracking-tight mb-1">{file ? '엑셀 업로드 완료' : '중국 리스트 업로드'}</h4>
                <p className="text-[11px] font-medium text-slate-400 px-4 truncate max-w-full">
                    {file ? file.name : 'OZ / OH 패킹 엑셀'}
                </p>
              </div>
            </div>

            <button
                onClick={handleProcess}
                disabled={!file || loading}
                className="w-full mt-8 bg-slate-900 hover:bg-black disabled:opacity-10 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 text-base"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              중국 데이터 동기화
            </button>

            {file && (
              <button
                  onClick={handleAddSignature}
                  disabled={signing || (!file.type.startsWith('image/') && !results)}
                  title={file.type.startsWith('image/') ? '업로드한 이미지에 David 서명을 추가해서 다운로드합니다' : (results ? '변환 결과 화면을 캡쳐해서 David 서명을 추가합니다' : '엑셀 파일은 먼저 데이터를 동기화한 뒤 이용할 수 있어요')}
                  className="w-full mt-4 bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-700 font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 active:scale-95 text-base disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Signature className="w-5 h-5" />}
                서명 추가
              </button>
            )}

            {results && (
              <>
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => generateAndDownload(results.filter((r: any) => getChinaTabGroup(r.originSheet) === activeTab), verification?.fileName || '중국패킹')}
                    className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-3 active:scale-95 text-base"
                >
                  <Download className="w-5 h-5" />
                  최종 엑셀 다운로드
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
                const activeOriginal = results ? results.filter((item: any) => getChinaTabGroup(item.originSheet) === activeTab).reduce((acc, cur) => acc + (cur.pdfQty || cur.qty || 0), 0) : verification.originalTotal;
                const activeMatched = results ? results.filter((item: any) => getChinaTabGroup(item.originSheet) === activeTab).reduce((acc, cur) => acc + (cur.qty || 0), 0) : verification.matchedTotal;
                const isVerified = activeOriginal === activeMatched && activeOriginal > 0;
                return (
                  <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} className="m-6 grid grid-cols-3 gap-3">
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400">원본 수량</p>
                        <p className="text-xl font-black text-slate-900">{activeOriginal}</p>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400">매칭 수량</p>
                        <p className="text-xl font-black text-red-600">{activeMatched}</p>
                      </div>
                    </div>
                    <div className={`p-5 rounded-2xl border flex items-center gap-3 ${isVerified ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                      {isVerified ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
                      <div>
                        <p className={`text-sm font-bold ${isVerified ? 'text-green-700' : 'text-amber-700'}`}>{isVerified ? '수량 일치' : '수량 확인 필요'}</p>
                        <p className="text-[11px] text-slate-400">{isVerified ? '정상적으로 검증됨' : '원본/매칭 수량이 달라요'}</p>
                      </div>
                    </div>
                  </motion.div>
                );
             })()}

             <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-red-600" />
                    변환 결과
                  </h3>
                  <button 
                    onClick={() => setIsSettingOpen(true)}
                    className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 group"
                    title="분류 키워드 설정"
                  >
                    <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                  </button>
                </div>
                {results && (
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-xl overflow-x-auto max-w-[500px] custom-scrollbar">
                    {Array.from(new Set(results.map((r: any) => getChinaTabGroup(r.originSheet)))).map((tab: any) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                )}
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-16 h-16 border-[4px] border-red-100 border-t-red-600 rounded-full animate-spin mb-6" />
                      <p className="text-xs font-black text-red-400 uppercase tracking-widest animate-pulse italic tracking-tighter">Analyzing Factory Orders...</p>
                    </div>
                  ) : results ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white/100 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Master SKU</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Matrix</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty Score</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Valid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(() => {
                          const filtered = results.map((item: any, originalIndex: number) => ({ item, originalIndex }))
                            .filter(({ item }: any) => {
                               const isTotalRow = !item.matchedName && !item.size && !item.color && item.qty > 0;
                               return getChinaTabGroup(item.originSheet) === activeTab && !isTotalRow;
                          });

                          // 같은 상품(스타일+매칭코드+색상+사이즈)이 서로 다른 박스에 나뉘어 있는 경우
                          // 화면에서는 하나로 합쳐서 보여준다 (엑셀 다운로드/파레트 출력은 지금처럼
                          // 박스 단위 원본 그대로 사용하므로 박스별 정확도에는 영향이 없다).
                          // 그룹의 대표 인덱스로 수정하면 selectProduct의 기존 "같은 스타일 일괄
                          // 교정" 로직이 같은 그룹의 다른 박스 행도 알아서 같이 고쳐준다.
                          const groupOrder: string[] = [];
                          const groupMap = new Map<string, any>();
                          filtered.forEach(({ item, originalIndex }: any) => {
                              const key = `${item.style}|${item.matchedCode}|${item.matchedName}|${item.color}|${item.size}`;
                              if (!groupMap.has(key)) {
                                  groupOrder.push(key);
                                  groupMap.set(key, { item: { ...item }, indices: [originalIndex], allVerified: !!item.verified });
                              } else {
                                  const g = groupMap.get(key);
                                  g.item.qty += item.qty;
                                  g.indices.push(originalIndex);
                                  g.allVerified = g.allVerified && !!item.verified;
                              }
                          });
                          const displayedResults = groupOrder.map(key => groupMap.get(key));

                          return displayedResults.map((group: any, idx: number) => {
                          const { item, indices, allVerified } = group;
                          const originalIndex = indices[0];
                          const boxCount = indices.length;
                          const isNewGroup = idx > 0 && item.style !== displayedResults[idx - 1].item.style;
                          return (
                            <React.Fragment key={originalIndex}>
                              {isNewGroup && (
                                <tr className="bg-slate-50/30">
                                  <td colSpan={4} className="h-2 border-t border-slate-100"></td>
                                </tr>
                              )}
                              <tr
                                onClick={() => {
                                    setEditingIndex(originalIndex);
                                    setSearchTerm('');
                                    setIsModalOpen(true);
                                    setSearchResults([]);
                                }}
                                className={`group hover:bg-red-50/50 transition-colors cursor-pointer ${isNewGroup ? 'border-t border-slate-200' : ''}`}
                              >
                                <td className="p-6 text-sm font-black text-slate-400 tracking-widest group-hover:text-red-600 transition-colors flex items-center gap-2">
                                   <span
                                     className={`w-1.5 h-1.5 rounded-full shrink-0 ${allVerified ? 'bg-green-500' : 'bg-red-500'}`}
                                     title={allVerified ? '상품코드/상품명/색상/사이즈 DB 일치 확인됨' : 'DB와 완전히 일치하지 않음 — 확인 필요'}
                                   />
                                   {item.matchedCode}
                                   <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </td>
                                <td className="p-6">
                                   <div className="mb-1.5 flex items-center gap-2">
                                       <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase tracking-tighter">REF: {item.style}</span>
                                   </div>
                                   <span className="text-sm font-bold text-slate-800 block mb-1 group-hover:text-red-900 transition-colors">{item.matchedName}</span>
                                   <span className="text-[9px] text-slate-400 font-bold uppercase block italic group-hover:text-red-400">
                                       {item.size} / {item.color}
                                       {boxCount > 1 && <span className="ml-1 text-slate-300 normal-case">({boxCount}박스 합산)</span>}
                                   </span>
                                </td>
                                <td className="p-4 text-center">
                                   <div className="flex items-center justify-center gap-3">
                                       <span className="text-sm font-black text-slate-900">{item.qty}</span>
                                   </div>
                                </td>
                                <td className="p-4 text-center">
                                   <div className="flex items-center justify-center gap-2">
                                       {(item.matchedCode === '미매칭' || item.matchedCode === '코드누락' || item.matchedCode === '중복확인') ? (
                                           <div className="bg-amber-50 text-amber-600 p-1.5 rounded-lg shadow-sm" title="확인 필요: 클릭해서 수동으로 상품을 선택하세요">
                                               <AlertCircle className="w-3.5 h-3.5" strokeWidth={3} />
                                           </div>
                                       ) : (
                                           <div className="bg-red-50 text-red-600 p-1.5 rounded-lg shadow-sm">
                                               <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                                           </div>
                                       )}
                                       <button
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               const indexSet = new Set(indices);
                                               const newResults = results.filter((_, i) => !indexSet.has(i));
                                               setResults(newResults);
                                           }}
                                           className="bg-white text-slate-300 hover:bg-red-100 hover:text-red-600 p-1.5 rounded-lg shadow-sm transition-all border border-slate-100 hover:border-red-200"
                                           title="목록에서 제외"
                                       >
                                           <X className="w-3.5 h-3.5" strokeWidth={3} />
                                       </button>
                                   </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                          });
                        })()}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-slate-400 grayscale scale-[0.7] transition-all">
                      <Table className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Factory Feed</p>
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
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="상품명 또는 상품코드를 입력하세요..."
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
                  <div className="bg-red-50 p-3 rounded-2xl">
                    <Settings className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">분류 키워드 설정</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Classification Keywords</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                {/* Shoe Keywords Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-4 h-4 text-pink-500" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">신발 (Shoes) 키워드</h4>
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {shoeKeywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-2 shadow-sm hover:border-pink-300 transition-colors">
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
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => { if(newShoeKey.trim()) { saveKeywords('shoe', [...shoeKeywords, newShoeKey.trim()]); setNewShoeKey(''); }}}
                      className="px-6 py-4 bg-pink-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-pink-600 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      추가
                    </button>
                  </div>
                </div>

                {/* Clothing Keywords Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="w-4 h-4 text-green-500" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">의류 (Clothing) 키워드</h4>
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {clothingKeywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-2 shadow-sm hover:border-green-300 transition-colors">
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
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={() => { if(newClothingKey.trim()) { saveKeywords('clothing', [...clothingKeywords, newClothingKey.trim()]); setNewClothingKey(''); }}}
                      className="px-6 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all flex items-center gap-2"
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
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
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
