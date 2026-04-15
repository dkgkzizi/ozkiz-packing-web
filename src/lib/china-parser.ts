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
 * 중국 패킹리스트 범용 지능형 파서 (XLS, XLSX, PDF 지원)
 */
export async function getChinaPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  // 1. 엑셀 파일 처리 시도 (구형 .XLS 포함)
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    let results: PackingResult[] = [];
    
    if (jsonData.length > 0) {
        // 중국 제작사 엑셀 헤더 패턴 분석 및 데이터 추출
        jsonData.forEach((row, idx) => {
            if (idx === 0) return; // 헤더 스킵
            
            let style = String(row[0] || "").trim(); // 첫 번째 컬럼: 종종 스타일 번호
            let qty = parseInt(String(row[4] || row[3] || 0)); // 수량 컬럼 (D 또는 E)
            
            if (style && style.length >= 3 && qty > 0) {
                results.push({
                    style: style,
                    name: String(row[1] || "CHINA PRODUCT").trim(),
                    color: String(row[2] || "VARIOUS").trim(),
                    size: "FREE",
                    qty: qty
                });
            }
        });
        
        if (results.length > 0) return results;
    }
  } catch (e) {
    console.log("Not a recognizable Excel (XLS/XLSX) file, trying PDF fallback...");
  }

  // 2. PDF/Image 파싱 로직 (Fallback)
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
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - t.y) < 0.25);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[t.y] = [{ x: t.x, text: txt }];
            });

            Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b)).forEach(ry => {
                let cols = rowsRaw[ry].sort((a,b) => a.x - b.x);
                let styleCand = cols.find(c => /^[A-Z0-9]{4,15}$/.test(c.text) && c.x < 10.0);
                if (styleCand) curS = styleCand.text;
                let qtyCol = cols.find(c => c.x > 20.0 && /^[0-9]+$/.test(c.text));
                if (qtyCol && curS) {
                    results.push({
                        style: curS,
                        name: "CHINA PRODUCT",
                        color: "VARIOUS",
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
