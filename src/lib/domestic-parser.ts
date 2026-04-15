import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 국내 패킹리스트 범용 파서 (PDF & Excel 지원)
 */
export async function getDomesticPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  // 1. 엑셀 파일 처리 시도
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    let results: PackingResult[] = [];
    const worksheet = workbook.worksheets[0];

    worksheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        
        // 국내 스타일 번호 (S로 시작하거나 길이 6자 이상)
        let style = row.getCell(1).text?.trim() || "";
        let qty = parseInt(row.getCell(5).text) || parseInt(row.getCell(4).text) || 0;
        
        if (style && style.length >= 3 && qty > 0) {
            results.push({
                style: style,
                name: row.getCell(2).text?.trim() || "국내 상품",
                color: row.getCell(3).text?.trim() || "기본",
                size: "FREE",
                qty: qty
            });
        }
    });
    if (results.length > 0) return results;
  } catch (e) {
    console.log("Not an Excel file, falling back to PDF...");
  }

  // 2. PDF/Image 처리 로직
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let curS = "";
        
        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                if (!txt) return;
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - t.y) < 0.3);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[t.y] = [{ x: t.x, text: txt }];
            });

            Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b)).forEach(ry => {
                let cols = rowsRaw[ry].sort((a,b) => a.x - b.x);
                let styleCand = cols.find(c => /^[A-Z][0-9]{5,7}$/.test(c.text) || (c.text.length >= 6 && c.text.startsWith('S')));
                if (styleCand) curS = styleCand.text;
                let qtyCol = cols.find(c => c.x > 15.0 && /^[0-9]{1,4}$/.test(c.text));
                if (qtyCol && curS) {
                    results.push({
                        style: curS,
                        name: "국내 상품",
                        color: "기본",
                        size: "FREE",
                        qty: parseInt(qtyCol.text)
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
