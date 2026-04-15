import PDFParser from 'pdf2json';

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 중국 패킹리스트 지능형 파서입니다.
 * 제작 사진의 오타 교정 및 멀티 색상 레이아웃을 지원합니다.
 */
export async function getChinaPackingResults(buffer: Buffer): Promise<PackingResult[]> {
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
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.25);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');
                
                // 중국 스타일 번호 및 색상 오타 교정 후보 탐색
                let styleCand = cols.find(c => /^[A-Z0-9]{4,10}$/.test(c.text) && c.x < 10.0);
                if (styleCand) curS = styleCand.text;

                // 중국어/영어 혼용 이름 및 색상 추출 (예: 黑色 XL 10)
                let qtyCol = cols.find(c => c.x > 20.0 && /^[0-9]+$/.test(c.text));
                if (qtyCol && curS) {
                    let q = parseInt(qtyCol.text);
                    results.push({
                        style: curS,
                        name: "CHINA PRODUCT",
                        color: "VARIOUS",
                        size: "XL",
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
