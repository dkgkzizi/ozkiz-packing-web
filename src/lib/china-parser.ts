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
export async function getChinaPackingResults(buffer: Buffer, fileName: string = ""): Promise<PackingResult[]> {
  const isExcel = fileName.toLowerCase().endsWith('.xls') || fileName.toLowerCase().endsWith('.xlsx');

  // 1. 엑셀 파일 처리 (XLS, XLSX) - 확장자가 엑셀이면 우선 처리
  if (isExcel || buffer.slice(0, 4).toString('hex') === '504b0304' || buffer.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      let results: PackingResult[] = [];
      
      if (jsonData.length > 0) {
          // 시트 전체를 유연하게 스캔하여 데이터 행 찾기
          jsonData.forEach((row) => {
              if (!Array.isArray(row)) return;

              // 스타일 번호 후보 찾기 (보통 앞쪽 3개 컬럼 중 하나에 위치)
              let style = "";
              let foundStyleIdx = -1;
              for (let i = 0; i < Math.min(row.length, 5); i++) {
                  const val = String(row[i] || "").trim();
                  // 스타일 코드는 보통 영문/숫자 혼합 4자 이상
                  if (/^[A-Z0-9-]{4,20}$/.test(val) && !['DATE','SIZE','TOTAL','PAGE','STYLE'].includes(val)) {
                      style = val;
                      foundStyleIdx = i;
                      break;
                  }
              }

              // 수량 후보 찾기 (스타일 번호 이후 컬럼 중 숫자인 것)
              if (style) {
                  for (let i = foundStyleIdx + 1; i < row.length; i++) {
                      const val = parseInt(String(row[i] || "").replace(/[^0-9]/g, ''));
                      if (val > 0 && val < 5000) {
                        results.push({
                            style: style,
                            name: String(row[foundStyleIdx + 1] || "CHINA PRODUCT").trim(),
                            color: String(row[foundStyleIdx + 2] || "VARIOUS").trim(),
                            size: "FREE",
                            qty: val
                        });
                        break; // 한 행에서 첫 번째 유효 수량을 찾으면 기록
                      }
                  }
              }
          });
          
          if (results.length > 0) return results;
      }
    } catch (e) {
      console.error("Excel processing failed:", e);
      if (isExcel) throw new Error("엑셀 파일 구조 분석에 실패했습니다. (손상된 파일일 수 있습니다)");
    }
  }

  // 2. PDF 파서 (엑셀이 확실히 아니거나 엑셀에서 데이터를 못 찾았을 때만 실행)
  if (isExcel) throw new Error("업로드된 엑셀 파일에서 패킹 데이터를 찾을 수 없습니다.");

  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error("PDF 분석 오류: " + errData.parserError)));
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
