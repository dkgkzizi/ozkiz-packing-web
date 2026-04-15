import PDFParser from 'pdf2json';

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 국내 패킹리스트 전용 파서입니다. 
 * 이미지 분석 또는 PDF 텍스트 추출을 통해 표준 데이터를 반환합니다.
 */
export async function getDomesticPackingResults(buffer: Buffer): Promise<PackingResult[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let curS = "", curN = "", curC = "";
        
        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                if (!txt) return;
                let y = t.y;
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.3);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');
                
                // 국내용 상품코드 인식 (S로 시작하는 6~7자리 등)
                let styleCand = cols.find(c => /^[A-Z][0-9]{5,7}$/.test(c.text) || (c.text.length >= 6 && c.text.startsWith('S')));
                if (styleCand) curS = styleCand.text;

                // 수량 데이터 추출
                let qtyCol = cols.find(c => c.x > 15.0 && /^[0-9]{1,4}$/.test(c.text));
                if (qtyCol && curS) {
                    let q = parseInt(qtyCol.text);
                    results.push({
                        style: curS,
                        name: "국내 상품",
                        color: "기본",
                        size: "FREE",
                        qty: q
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
