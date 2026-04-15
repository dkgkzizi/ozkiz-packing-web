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
export async function getDomesticPackingResults(buffer: Buffer, fileName: string = ""): Promise<PackingResult[]> {
  const isExcel = fileName.toLowerCase().endsWith('.xls') || fileName.toLowerCase().endsWith('.xlsx');

  // 1. 엑셀 파일 처리 (구형 .XLS 포함)
  if (isExcel || buffer.slice(0, 4).toString('hex') === '504b0304' || buffer.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      let results: PackingResult[] = [];
      
      if (jsonData.length > 0) {
          jsonData.forEach((row) => {
              if (!Array.isArray(row)) return;

              let style = "";
              let foundStyleIdx = -1;
              for (let i = 0; i < Math.min(row.length, 5); i++) {
                  const val = String(row[i] || "").trim();
                  if (/^[A-Z][0-9]{4,10}$/.test(val) || (val.length >= 6 && val.startsWith('S'))) {
                      style = val;
                      foundStyleIdx = i;
                      break;
                  }
              }

              if (style) {
                  for (let i = foundStyleIdx + 1; i < row.length; i++) {
                      const val = parseInt(String(row[i] || "").replace(/[^0-9]/g, ''));
                      if (val > 0 && val < 5000) {
                        results.push({
                            style: style,
                            name: String(row[foundStyleIdx + 1] || "국내 상품").trim(),
                            color: String(row[foundStyleIdx + 2] || "기본").trim(),
                            size: "FREE",
                            qty: val
                        });
                        break;
                      }
                  }
              }
          });
          if (results.length > 0) return results;
      }
    } catch (e) {
      if (isExcel) throw new Error("국내 엑셀 분석 실패: " + (e as Error).message);
    }
  }

  if (isExcel) throw new Error("업로드된 엑셀 파일에서 유효한 스타일/수량 데이터를 찾을 수 없습니다.");

  // 2. PDF 처리 로직 (Fallback)
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error("PDF 분석 오류")));
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
