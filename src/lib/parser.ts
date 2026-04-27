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
                let rawCols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                // 뭉친 텍스트 분해 (사이즈가 "100 110 120" 처럼 뭉쳐있는 경우 대응)
                let cols: any[] = [];
                rawCols.forEach(rc => {
                    if (rc.text.includes('  ') || (rc.text.match(/[0-9]{3}/g)?.length || 0) > 1) {
                        let parts = rc.text.split(/\s+/);
                        parts.forEach((p, i) => {
                            if (p.trim()) cols.push({ x: rc.x + (i * 2), text: p.trim() });
                        });
                    } else {
                        cols.push(rc);
                    }
                });

                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');

                // 1. 사이즈 헤더 감지 (유연성 최대화)
                let potSizes = cols.filter(c => {
                    const t = c.text.trim().toUpperCase();
                    const isNumSize = /^[0-9]{2,3}$/.test(t) && parseInt(t) >= 70 && parseInt(t) <= 190;
                    const isWordSize = ['S','M','L','XL','FREE','OS'].some(s => t.includes(s));
                    return c.x > 10.0 && (isNumSize || isWordSize) && !['DATE','PRICE','PCS','TOTAL'].some(k => t.includes(k));
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

                // 3. 데이터 행 판별
                const isMetaRow = fullText.startsWith('TOTAL') || fullText.includes('PAGE ') || fullText.includes('DATE :') || fullText.includes('SHIPPER');
                let hasQtyData = cols.some(c => Object.keys(sizes).some(sx => Math.abs(c.x - parseFloat(sx)) < 4.0) && /^[0-9]+$/.test(c.text.trim()));
                let isDataRow = !isMetaRow && hasQtyData;

                if (isDataRow) {
                    const styleRegex = /[A-Z]{1,2}[0-9]{2}[A-Z]{1,2}[0-9]{2,4}[A-Z]?/i;
                    let styleInRow = cols.find(c => c.x < 25.0 && styleRegex.test(c.text));
                    if (styleInRow) curS = styleInRow.text.trim();

                    let rowBoxes = 1;
                    let ctnNums = cols.filter(c => c.x < 15.0 && /^[0-9]+$/.test(c.text))
                                     .map(c => parseInt(c.text))
                                     .sort((a, b) => a - b);
                    if (ctnNums.length >= 2) rowBoxes = (ctnNums[ctnNums.length - 1] - ctnNums[0] + 1);
                    if (rowBoxes <= 0 || rowBoxes > 300) rowBoxes = 1;

                    let dataCand = cols.find(c => c.x >= 8.0 && c.x < 35.0 && c.text.length > 3 && !Object.values(sizes).includes(c.text) && !styleRegex.test(c.text));
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
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 3.8 && /^[0-9]+$/.test(c.text.trim()));
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.trim()) || 0;
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