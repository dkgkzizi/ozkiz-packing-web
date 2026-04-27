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

export async function getRawPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let sizes: Record<string, string> = {}; 
        let curS = "", curN = "", curC = "";
        const styleRegex = /[A-Z]{1,2}[0-9]{2}[A-Z]{1,2}[0-9]{2,4}[A-Z]?/i;

        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = t.R[0].T.trim(); }
                if (!txt) return;
                let y = t.y.toFixed(2);
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - parseFloat(y)) < 0.45);
                if (targetY) rowsRaw[targetY].push({ x: parseFloat(t.x.toFixed(2)), text: txt });
                else rowsRaw[y] = [{ x: parseFloat(t.x.toFixed(2)), text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');

                // 1. 사이즈 헤더 감지
                let potSizes = cols.filter(c => {
                    const t = c.text.trim().toUpperCase();
                    const isNum = /^[0-9]{2,3}$/.test(t) && parseInt(t) >= 60 && parseInt(t) <= 190;
                    const isWord = ['S','M','L','XL','FREE','OS'].some(w => t === w);
                    return c.x > 8.0 && (isNum || isWord);
                });
                
                // [핵심 해결] 데이터 행(스타일 번호나 색상이 있는 행)의 숫자를 사이즈 헤더로 오인하는 문제 차단
                const hasStyleOrColor = cols.some(c => styleRegex.test(c.text)) || cols.some(c => COLORS.some(cl => c.text.toUpperCase().includes(cl)));

                if (!hasStyleOrColor && potSizes.length >= 2 && !fullText.includes('TOTAL') && !fullText.includes('SHIPPER')) {
                    sizes = {}; 
                    potSizes.forEach(sc => { sizes[sc.x.toString()] = sc.text.trim(); });
                    return; 
                }

                // 2. 스타일 식별 (x 좌표 2.0 ~ 12.0 부근)
                let styleInRow = cols.find(c => c.x > 2.0 && c.x < 12.0 && styleRegex.test(c.text));
                if (styleInRow) curS = styleInRow.text.trim();

                const isMetaRow = fullText.startsWith('TOTAL') || fullText.includes('PAGE ') || fullText.includes('DATE :');
                if (isMetaRow) return;

                // 3. 데이터 행 추출
                // 수량: 사이즈 헤더 x좌표와 일치(오차 0.8 미만으로 제한하여 다른 열 숫자 배제)하는 숫자만 추출
                let qtyColCandidates = cols.filter(c => 
                    Object.keys(sizes).some(sx => Math.abs(c.x - parseFloat(sx)) < 0.8) && 
                    /^[0-9]+$/.test(c.text.trim()) && !c.text.includes('.')
                );
                
                if (qtyColCandidates.length > 0) {
                    // 박스 번호: x < 5.0 영역의 숫자만 추출
                    let boxNums = cols.filter(c => c.x < 5.0 && /^[0-9]+$/.test(c.text.trim()) && !c.text.includes('.')).map(c => parseInt(c.text));
                    let boxes = boxNums.length >= 2 ? (Math.max(...boxNums) - Math.min(...boxNums) + 1) : 1;
                    if (boxes <= 0 || boxes > 250) boxes = 1;

                    // 색상: x 좌표 5.0 ~ 20.0 영역 내의 텍스트 추출
                    let colorCand = cols.find(c => c.x >= 5.0 && c.x < 20.0 && c.text.length > 2 && !styleRegex.test(c.text) && !Object.values(sizes).includes(c.text) && !c.text.includes('.'));
                    if (colorCand) {
                        let txt = colorCand.text.toUpperCase();
                        let foundColor = COLORS.find(cl => txt.includes(cl));
                        if (foundColor) {
                            curC = foundColor;
                            curN = colorCand.text.replace(foundColor, '').replace(/[-\s]/g, ' ').trim();
                        } else { curC = colorCand.text; curN = ""; }
                    }
                    if (!curN) curN = curS;

                    // 수량 매칭 및 저장
                    let matchedSizes = new Set();
                    qtyColCandidates.forEach(qc => {
                        let closestSx = Object.keys(sizes).reduce((prev, curr) => Math.abs(parseFloat(curr) - qc.x) < Math.abs(parseFloat(prev) - qc.x) ? curr : prev);
                        
                        // 다시 한번 오차 0.8 미만 검증
                        if (Math.abs(parseFloat(closestSx) - qc.x) < 0.8 && !matchedSizes.has(closestSx)) {
                            let q = parseInt(qc.text.trim());
                            if (q > 0 && q < 1000) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[closestSx], qty: q * boxes });
                                matchedSizes.add(closestSx);
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
  Object.values(aggregated).forEach(res => worksheet.addRow(res));
  worksheet.eachRow(row => {
      row.eachCell(cell => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
  });
  return workbook;
}