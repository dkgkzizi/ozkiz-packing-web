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
 * 중국 패킹리스트 범용 파서 (PDF & Excel 지원)
 */
export async function getChinaPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  // 1. 엑셀 파일인지 먼저 확인 (파일 매직 넘버 또는 구조 확인)
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    // 엑셀 파싱 성공 시 엑셀 로직 실행
    let results: PackingResult[] = [];
    const worksheet = workbook.worksheets[0];

    worksheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // 헤더 스킵
        
        let style = row.getCell(1).text?.trim() || "";
        let qty = parseInt(row.getCell(5).text) || parseInt(row.getCell(4).text) || 0;
        
        if (style && style.length >= 3 && qty > 0) {
            results.push({
                style: style,
                name: row.getCell(2).text?.trim() || "CHINA PRODUCT",
                color: row.getCell(3).text?.trim() || "VARIOUS",
                size: "FREE",
                qty: qty
            });
        }
    });
    
    if (results.length > 0) return results;
  } catch (e) {
    // 엑셀이 아니면 PDF 파싱으로 넘어감
    console.log("Not an Excel file, trying PDF parser...");
  }

  // 2. PDF 파싱 로직 (기존 로직 유지 및 강화)
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
