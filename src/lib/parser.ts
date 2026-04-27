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

        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                if (!txt) return;
                let y = t.y;
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.28);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');

                // 1. 사이즈 헤더 감지 (엄격한 화이트리스트 방식)
                let potSizes = cols.filter(c => {
                    const t = c.text.trim().toUpperCase();
                    // 사이즈는 80~180 사이의 숫자이거나 특정 키워드여야 함
                    const isNumSize = /^[0-9]{2,3}$/.test(t) && parseInt(t) >= 70 && parseInt(t) <= 190;
                    const isWordSize = ['S','M','L','XL','XXL','FREE','OS'].some(s => t === s || t.includes(`(${s})`) || t.includes(`${s}(`));
                    return c.x > 15.0 && c.x < 100.0 && (isNumSize || isWordSize);
                });
                
                if (potSizes.length >= 2 && !fullText.startsWith('TOTAL') && !fullText.includes('SHIPPER')) {
                    sizes = {}; 
                    potSizes.forEach(sc => { sizes[sc.x] = sc.text.trim(); });
                    return; 
                }

                // 2. 스타일 번호 감지
                if (fullText.includes('STYLE') || fullText.includes('MODEL')) {
                    const sMatch = fullText.match(/(?:STYLE|MODEL)\s*(?:NO)?\s*[:\.]?\s*([A-Z0-9-]+)/i);
                    if (sMatch && sMatch[1].length >= 3) curS = sMatch[1].trim();
                }

                // 3. 데이터 행 판단
                const isMetaRow = (
                    fullText.startsWith('TOTAL') || fullText.includes('PAGE ') || 
                    fullText.includes('DATE :') || fullText.includes('SHIPPER')
                );

                // 수량 데이터 존재 여부 (사이즈 컬럼 x좌표 근처에 숫자가 있는지 확인)
                let hasQtyInSizeCol = cols.some(c => 
                    Object.keys(sizes).some(sx => Math.abs(c.x - parseFloat(sx)) < 3.0) && 
                    /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,''))
                );
                
                let isDataRow = !isMetaRow && hasQtyInSizeCol && (curS.length >= 3 || cols.some(c => c.x < 15.0 && c.text.length >= 6));

                if (isDataRow) {
                    let styleInRow = cols.find(c => c.x >= 4.0 && c.x < 20.0 && c.text.length >= 6 && !c.text.includes(':') && /[0-9]/.test(c.text));
                    if (styleInRow) curS = styleInRow.text.trim();

                    let rowBoxes = 1;
                    let ctnNums = cols.filter(c => c.x >= 0 && c.x < 12.0 && /^[0-9]+$/.test(c.text))
                                     .map(c => parseInt(c.text))
                                     .sort((a, b) => a - b);
                    if (ctnNums.length >= 2) rowBoxes = (ctnNums[ctnNums.length - 1] - ctnNums[0] + 1);
                    if (rowBoxes <= 0 || rowBoxes > 200) rowBoxes = 1; // 비정상적인 박스 수 방어

                    let dataCand = cols.find(c => c.x >= 12.0 && c.x < 35.0 && c.text.length > 3 && !Object.values(sizes).includes(c.text));
                    if (dataCand) {
                        let r = dataCand.text;
                        let pts = r.split(/\s*[-–—]\s*/).map(p=>p.trim()).filter(p=>p.length > 0);
                        if (pts.length >= 2) {
                            let colorIdx = pts.findIndex(p => COLORS.some(cl => p.toUpperCase().includes(cl)));
                            if (colorIdx !== -1) {
                                curC = pts[colorIdx]; curN = pts.filter((_, i) => i !== colorIdx).join(' - ');
                            } else { curC = pts[0]; curN = pts.slice(1).join(' - '); }
                        } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                            curC = r; curN = "";
                        } else { curN = r; curC = ""; }
                    }
                    
                    if (!curN) curN = curS;
                    
                    Object.keys(sizes).forEach(sx => {
                        let sxNum = parseFloat(sx);
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 2.5 && /^[0-9]+$/.test(c.text.trim()));
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.trim()) || 0;
                            // 개별 품목 수량이 비정상적으로 큰 경우(예: 1000개 초과) 방어
                            if (q > 0 && q < 1000) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * rowBoxes });
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
  finalResults.forEach(res => worksheet.addRow(res));
  worksheet.eachRow(row => {
      row.eachCell(cell => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
  });
  return workbook;
}