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
        let curBoxes = 1;

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

                // 1. 스타일 번호 추출 (Aggressive)
                const styleRegex = /[A-Z]{1,2}[0-9]{2}[A-Z]{1,2}[0-9]{2,4}[A-Z]?/i;
                let stylePart = cols.find(c => styleRegex.test(c.text) && !c.text.includes(':') && c.text.length >= 6);
                if (stylePart) curS = stylePart.text.trim();
                else if (fullText.includes('STYLE') || fullText.includes('MODEL')) {
                    const sMatch = fullText.match(/(?:STYLE|MODEL)\s*(?:NO)?\s*[:\.]?\s*([A-Z0-9-]+)/i);
                    if (sMatch && sMatch[1].length >= 5) curS = sMatch[1].trim();
                }

                // 2. 사이즈 헤더 감지 (가로 범위 100.0까지 확대)
                let potSizes = cols.filter(c => 
                    c.x > 8.0 && c.x < 100.0 && c.text.length <= 10 && 
                    !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN','NT.WT','GR.WT','KGS','DATE','PRICE','STYLE','COLOUR','MODEL','NAME'].some(k => c.text.toUpperCase().includes(k)) &&
                    /^[0-9A-Z/\-\s]+$/.test(c.text.replace(/[^0-9A-Z/\-\s]/g,''))
                );
                
                if (potSizes.length >= 2 && !cols.some(c => c.x < 5.0 && c.text.length > 20)) {
                    sizes = {}; 
                    potSizes.forEach(sc => { 
                        const sTxt = sc.text.trim();
                        if (sTxt && sTxt.length < 8) sizes[sc.x] = sTxt;
                    });
                    return; 
                }

                // 3. 데이터 행 판단 (가로 범위 확대 및 조건 유연화)
                const isMetaRow = (
                    fullText.includes('TOTAL') && (fullText.includes('KGS') || fullText.includes('PCS') || fullText.includes('CTNS')) ||
                    fullText.includes('PAGE ') || fullText.includes('DATE :') || fullText.includes('SHIPPER')
                );

                let hasQtyData = cols.some(c => c.x >= 12.0 && c.x < 100.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                let isDataRow = !!(cols.find(c => c.x < 10.0 && /^[0-9\.]+$/.test(c.text))) || (hasQtyData && curS.length >= 3);

                if (isDataRow && !isMetaRow) {
                    const isGeneric = (s: string) => ['TOP AND BTM', 'MADE IN', 'SET', 'PCS', 'TOTAL'].some(k => s.toUpperCase().includes(k));
                    if (isGeneric(curS) || curS.length < 5) {
                        const alternative = cols.find(c => c.text.length >= 6 && !isGeneric(c.text) && /[0-9]/.test(c.text));
                        if (alternative) curS = alternative.text.trim();
                    }

                    // 박스 수 계산
                    let ctnNums = cols.filter(c => c.x >= 0 && c.x < 10.0 && /^[0-9]+$/.test(c.text))
                                     .map(c => parseInt(c.text))
                                     .sort((a, b) => a - b);
                    if (ctnNums.length >= 2) curBoxes = (ctnNums[ctnNums.length - 1] - ctnNums[0] + 1);
                    else if (ctnNums.length === 1) curBoxes = 1;

                    // 상품명/색상 추출
                    let dataCand = cols.find(c => c.x >= 6.0 && c.x < 35.0 && c.text.length > 3 && !Object.values(sizes).includes(c.text));
                    if (dataCand) {
                        let r = dataCand.text;
                        let pts = r.split(/\s*[-–—]\s*/).map(p=>p.trim()).filter(p=>p.length > 0);
                        if (pts.length >= 2) {
                            let colorIdx = pts.findIndex(p => COLORS.some(cl => p.toUpperCase().includes(cl)));
                            if (colorIdx !== -1) {
                                curC = pts[colorIdx];
                                curN = pts.filter((_, i) => i !== colorIdx).join(' - ');
                            } else {
                                curC = pts[0]; curN = pts.slice(1).join(' - ');
                            }
                        } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                            curC = r; curN = "";
                        } else { curN = r; curC = ""; }
                    }
                    
                    if (!curN) curN = curS;
                    
                    Object.keys(sizes).forEach(sx => {
                        let sxNum = parseFloat(sx);
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 3.5 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                            if (q > 0 && q < 5000) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * curBoxes });
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