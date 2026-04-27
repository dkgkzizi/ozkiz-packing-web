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

                // 1. 사이즈 헤더 감지
                let potSizes = cols.filter(c => {
                    const t = c.text.trim().toUpperCase();
                    return c.x > 15.0 && (/^[0-9]{2,3}$/.test(t) || ['S','M','L','FREE'].includes(t));
                });
                if (potSizes.length >= 2 && !fullText.includes('TOTAL') && !fullText.includes('SHIPPER')) {
                    sizes = {}; 
                    potSizes.forEach(sc => { sizes[sc.x] = sc.text.trim(); });
                    return; 
                }

                // 2. 스타일 및 메타 정보
                if (fullText.includes('STYLE') || fullText.includes('MODEL')) {
                    const sMatch = fullText.match(/(?:STYLE|MODEL)\s*(?:NO)?\s*[:\.]?\s*([A-Z0-9-]+)/i);
                    if (sMatch) curS = sMatch[1].trim();
                }

                const isMetaRow = fullText.startsWith('TOTAL') || fullText.includes('PAGE ') || fullText.includes('SHIPPER');
                if (isMetaRow) return;

                // 3. 데이터 추출
                let hasQty = cols.some(c => Object.keys(sizes).some(sx => Math.abs(c.x - parseFloat(sx)) < 3.0) && /^[0-9]+$/.test(c.text.trim()));
                if (hasQty) {
                    const styleRegex = /[A-Z]{1,2}[0-9]{2}[A-Z]{1,2}[0-9]{2,4}[A-Z]?/i;
                    let styleInRow = cols.find(c => c.x < 20.0 && styleRegex.test(c.text));
                    if (styleInRow) curS = styleInRow.text.trim();

                    let boxNums = cols.filter(c => c.x < 12.0 && /^[0-9]+$/.test(c.text.trim())).map(c => parseInt(c.text));
                    let boxes = boxNums.length >= 2 ? (Math.max(...boxNums) - Math.min(...boxNums) + 1) : 1;
                    if (boxes > 100) boxes = 1;

                    let colorCand = cols.find(c => c.x >= 12.0 && c.x < 30.0 && c.text.length > 3 && !styleRegex.test(c.text));
                    if (colorCand) {
                        let txt = colorCand.text.toUpperCase();
                        let foundColor = COLORS.find(cl => txt.includes(cl));
                        if (foundColor) {
                            curC = foundColor;
                            curN = colorCand.text.replace(foundColor, '').replace(/[-\s]/g, ' ').trim();
                        } else { curC = colorCand.text; curN = ""; }
                    }

                    Object.keys(sizes).forEach(sx => {
                        let sxNum = parseFloat(sx);
                        let qCol = cols.find(c => Math.abs(c.x - sxNum) < 2.5 && /^[0-9]+$/.test(c.text.trim()));
                        if (qCol) {
                            let q = parseInt(qCol.text.trim());
                            if (q > 0 && q < 500) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * boxes });
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