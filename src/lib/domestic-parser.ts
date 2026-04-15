import PDFParser from 'pdf2json';
import * as XLSX from 'xlsx';

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 국내 패킹리스트 범용 지능형 파서 (XLS, XLSX, PDF 지원)
 */
export async function getDomesticPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  // 1. 엑셀 파일 처리 시도 (구형 .XLS 지원)
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    let results: PackingResult[] = [];
    
    if (jsonData.length > 0) {
        jsonData.forEach((row, idx) => {
            if (idx === 0) return;
            
            let style = String(row[0] || "").trim();
            let qty = parseInt(String(row[4] || row[3] || 0));
            
            if (style && style.length >= 3 && qty > 0) {
                results.push({
                    style: style,
                    name: String(row[1] || "국내 상품").trim(),
                    color: String(row[2] || "기본").trim(),
                    size: "FREE",
                    qty: qty
                });
            }
        });
        if (results.length > 0) return results;
    }
  } catch (e) {
    console.log("Not a recognizable Excel (XLS/XLSX) file, falling back to PDF...");
  }

  // 2. PDF/Image 처리 로직 (Fallback)
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
