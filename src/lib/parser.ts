import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

const COLORS = [
    'BLACK', 'WHITE', 'NAVY', 'IVORY', 'GRAY', 'GREY', 'PINK', 'RED', 'BLUE', 'YELLOW', 'GREEN', 'PURPLE', 
    'CHARCOAL', 'BEIGE', 'MELANGE', 'KHAKI', 'WINE', 'GOLD', 'SILVER', 'MINT', 'BROWN', 'ORANGE', 'PEACH', 
    'CORAL', 'LIME', 'LAVENDER', 'COCOA', 'LIGHT BLUE', 'DARK GREY', 'NAVY BLUE', 'OFF WHITE'
];

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 모든 인도 패킹리스트 레이아웃을 소화할 수 있는 범용 고성능 파서입니다.
 * 좌표 유연성과 헤더 인식 로직을 극대화했습니다.
 */
export async function getRawPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let sizes: Record<string, string> = {}; 
        let curS = "", curN = "", curC = "";
        let curBoxes = 1;

        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                if (!txt) return;
                let y = t.y;
                // 세로 오차 범위를 소폭 조정하여 행 병합 최적화
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.28);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');
                
                // --- 1. 스타일 헤더 직접 감지 (STYLE NO: XXX) ---
                if (fullText.includes('STYLE NO')) {
                    const stylePart = cols.find(c => c.text.toUpperCase().includes('STYLE') && c.text.includes(':')) 
                                   || cols.find(c => c.text.length > 5 && (c.x < 15.0));
                    if (stylePart) {
                        const sMatch = fullText.match(/STYLE NO\s*:\s*([A-Z0-9-]+)/i);
                        if (sMatch) curS = sMatch[1];
                        else if (stylePart.text.length > 3) curS = stylePart.text.replace(/STYLE NO\s*:\s*/i, '').trim();
                    }
                }

                // --- 2. 사이즈 헤더 감지 (데이터 행 여부와 관계없이 상시 감지) ---
                // 사이즈는 보통 10.0~38.0 사이에 여러 개가 나열됨
                let potSizes = cols.filter(c => 
                    c.x > 12.0 && c.x < 38.0 && c.text.length <= 10 && 
                    !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN','NT.WT','GR.WT','KGS','DATE','PRICE'].some(k => c.text.toUpperCase().includes(k)) &&
                    /^[0-9A-Z/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
                );
                
                // 스타일 번호가 없고, 사이즈 같은 숫자/글자가 2개 이상 보이면 사이즈 행으로 간주
                if (potSizes.length >= 2 && !cols.some(c => c.x < 8.0 && c.text.length > 10)) {
                    sizes = {}; 
                    potSizes.forEach(sc => { sizes[sc.x] = sc.text; });
                    return; 
                }

                // --- 3. 데이터 행 처리 ---
                const isMetaRow = (
                    fullText.includes('TOTAL') && (fullText.includes('KGS') || fullText.includes('PCS') || fullText.includes('CTNS')) ||
                    fullText.includes('PAGE ') || fullText.includes('DATE :') || fullText.includes('WEIGHT') || fullText.includes('SHIPPER')
                );

                // 좌표 유연화: ctnF, ctnT 범위를 넓힘
                let ctnF = cols.find(c => c.x > 0.0 && c.x < 4.0 && /^[0-9]+$/.test(c.text));
                let ctnT = cols.find(c => c.x >= 1.5 && c.x < 6.0 && /^[0-9]+$/.test(c.text));
                
                // 스타일 번호 인식 범위를 4.0~12.0으로 확장 (이미지 기준)
                // 'TOP AND BTM' 같은 일반 명칭이 스타일 번호로 오인되지 않도록 필터링 추가
                let styleInZone = cols.find(c => 
                    c.x >= 4.0 && c.x < 12.0 && c.text.length >= 5 && 
                    !c.text.includes(':') &&
                    !['TOP AND BTM', 'TOP & BTM', 'TOP/BTM', 'MADE IN', 'SET', 'PCS', 'TOTAL'].some(k => c.text.toUpperCase().includes(k))
                );
                
                // 데이터 행 여부 판단: 박스 번호가 있거나, 스타일 정보와 수량 정보가 동시에 있을 때
                let hasQtyData = cols.some(c => c.x >= 12.0 && c.x < 40.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                let isDataRow = !!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3);

                if (isDataRow && !isMetaRow) {
                    if (styleInZone) curS = styleInZone.text;
                    
                    // --- 박스 수 자동 계산 시스템 ---
                    let ctnNums = cols.filter(c => c.x >= 0 && c.x < 7.0 && /^[0-9]+$/.test(c.text))
                                     .map(c => parseInt(c.text))
                                     .sort((a, b) => a - b);
                    
                    if (ctnNums.length >= 2) curBoxes = (ctnNums[ctnNums.length - 1] - ctnNums[0] + 1);
                    else if (ctnNums.length === 1) curBoxes = 1;
                    
                    // TOTAL CTNS 컬럼 우선 인식
                    let directBoxCount = cols.find(c => c.x >= 35.0 && c.x < 45.0 && /^[0-9]+$/.test(c.text));
                    if (directBoxCount) {
                        const dbVal = parseInt(directBoxCount.text);
                        if (dbVal > 0 && dbVal < 1000) curBoxes = dbVal;
                    }
                    if (curBoxes <= 0) curBoxes = 1;

                    // --- 상품명 및 색상 지능형 추출 ---
                    // 색상은 보통 스타일 번호 다음(x: 6.0~30.0)에 위치함
                    let dataCand = cols.find(c => c.x >= 6.0 && c.x < 30.0 && c.text.length > 3 && !Object.values(sizes).includes(c.text));
                    if (dataCand) {
                        let r = dataCand.text;
                        // 하이픈, 엔다시, 엠다시 모두 대응
                        let pts = r.split(/\s*[-–—]\s*/).map(p=>p.trim()).filter(p=>p.length > 0);
                        
                        if (pts.length >= 2) {
                            // 어느 쪽이 색상인지 판별
                            let colorIdx = pts.findIndex(p => COLORS.some(cl => p.toUpperCase().includes(cl)));
                            if (colorIdx !== -1) {
                                curC = pts[colorIdx];
                                curN = pts.filter((_, i) => i !== colorIdx).join(' - ');
                            } else {
                                // 색상 키워드가 없으면 첫 번째를 색상, 나머지를 상품명으로 임시 지정
                                curC = pts[0];
                                curN = pts.slice(1).join(' - ');
                            }
                        } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                            curC = r;
                            curN = ""; // 색상만 있는 경우
                        } else {
                            curN = r;
                            curC = ""; // 상품명만 있는 경우
                        }
                    }
                    
                    if (!curN) curN = curS; // 상품명이 없으면 스타일 번호라도 채움
                    
                    Object.keys(sizes).forEach(sx => {
                        let sxNum = parseFloat(sx);
                        // 수량 컬럼은 사이즈 헤더의 x좌표 근처에 위치함
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.5 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                            if (q > 0 && q < 5000) {
                                results.push({ 
                                    style: curS, 
                                    name: curN || curS, 
                                    color: curC, 
                                    size: sizes[sx], 
                                    qty: q * curBoxes 
                                });
                            }
                        }
                    });
                }
            });
        });
        resolve(results);
      } catch(e) { reject(e); }
    });
    pdfParser.parseBuffer(buffer);
  });
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const results = await getRawPackingResults(buffer);
  
  const aggregated: Record<string, any> = {};
  results.forEach(res => {
      const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
      if (aggregated[key]) aggregated[key].qty += res.qty;
      else aggregated[key] = { ...res };
  });
  
  const finalResults = Object.values(aggregated).sort((a: any, b: any) => a.style.localeCompare(b.style));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Packing List');
  worksheet.columns = [
      { header: 'STYLE NO', key: 'style', width: 25 },
      { header: '상품명', key: 'name', width: 35 },
      { header: '색상', key: 'color', width: 15 },
      { header: '사이즈', key: 'size', width: 12 },
      { header: '총수량', key: 'qty', width: 12 }
  ];
  
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  let totalQty = 0;
  finalResults.forEach(res => {
      worksheet.addRow(res);
      totalQty += (res as any).qty;
  });

  const totalRow = worksheet.addRow({ style: '총 합계', qty: totalQty });
  totalRow.font = { bold: true };
  totalRow.getCell('qty').font = { color: { argb: 'FFFF0000' }, bold: true };
  
  worksheet.eachRow(row => {
      row.eachCell(cell => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
  });

  return workbook;
}
// Final Universal fix: 1776137037629