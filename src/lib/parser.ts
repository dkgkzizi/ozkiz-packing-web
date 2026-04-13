import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

const COLORS = ['BLACK','IVORY','WHITE','RED','BLUE','PINK','BROWN','NAVY','GREEN','YELLOW','BEIGE','GRAY','GREY','ORANGE','YELLOW','GOLD','SILVER','PURPLE','KHAKI','MINT','MELANGE','CHARCOAL','WINE','COCOA','LAVENDER','CORAL','PEACH', 'OATMEAL', 'CREAM', 'CHOCO', 'LIME', 'MINT', 'SKY', 'WASHED', 'DENIM'];

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let curStyle = "", curName = "", curColor = "";
        
        let colMap = {
          style: -1,
          color: -1,
          sizes: [] as { x: number, name: string }[],
          totalCtns: -1,
          totalPcs: -1
        };

        pdfData.Pages.forEach((page: any) => {
          let rowsRaw: Record<number, any[]> = {};
          
          // 1. 텍스트 병합 및 좌표 정규화
          page.Texts.forEach((t: any) => {
            let txt = "";
            try { 
                txt = decodeURIComponent(t.R[0].T).trim(); 
            } catch(e) { 
                txt = (t.R[0].T).trim(); 
            }
            if (!txt) return;

            const x = t.x;
            const y = t.y;
            
            // 같은 행에 있고 거리가 매우 가까운 텍스트 병합 (쪼개진 글자 합치기)
            let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.4);
            if (targetY) {
                const row = rowsRaw[parseFloat(targetY)];
                const nearText = row.find(c => Math.abs(c.x + (c.w || 0) - x) < 0.3);
                if (nearText) {
                    nearText.text += txt;
                    nearText.w = (x - nearText.x) + (t.w || 0);
                } else {
                    row.push({ x: x, text: txt, w: t.w });
                }
            } else {
                rowsRaw[y] = [{ x: x, text: txt, w: t.w }];
            }
          });

          const sortedY = Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b));
          sortedY.forEach(ry => {
            const cols = rowsRaw[parseFloat(ry)].sort((a,b) => a.x - b.x);
            const lineText = cols.map(c => c.text.toUpperCase()).join(' ');

            // 2. 동적 헤더 인식 (공백이나 쪼개진 텍스트 대응)
            if (lineText.includes('STYLE') || lineText.includes('COLOUR') || lineText.includes('SIZE')) {
              cols.forEach(c => {
                const head = c.text.toUpperCase();
                if (head.includes('STYLE')) colMap.style = c.x;
                if (head.includes('COLOUR') || head.includes('COLOR')) colMap.color = c.x;
                if (head.includes('TOTAL') && head.includes('CTNS')) colMap.totalCtns = c.x;
                if (head.includes('TOTAL') && head.includes('PCS')) colMap.totalPcs = c.x;
                
                // 사이즈 헤더 (연속된 숫자들)
                if (/^[0-9]+$/.test(c.text) && parseInt(c.text) >= 70 && parseInt(c.text) <= 500) {
                    if (!colMap.sizes.find(s => Math.abs(s.x - c.x) < 0.5)) {
                        colMap.sizes.push({ x: c.x, name: c.text });
                    }
                }
              });
              
              // 사이즈 헤더가 다른 행에 걸쳐 있을 경우 주변에서 보충
              if (colMap.sizes.length < 2) {
                 cols.filter(c => c.x > 8 && c.x < 35 && /^[0-9]+$/.test(c.text)).forEach(c => {
                    if (!colMap.sizes.find(s => Math.abs(s.x - c.x) < 0.5)) {
                        colMap.sizes.push({ x: c.x, name: c.text });
                    }
                 });
              }
              return;
            }

            // 3. 메타 데이터 및 합계 제외
            const isMeta = ['PAGE', 'INVOICE', 'DATE', 'PACKING', 'LIST', 'WEIGHT', 'CTN.MST', 'GR.WT', 'NT.WT'].some(k => lineText.includes(k));
            const isTotal = lineText.includes('TOTAL') || lineText.startsWith('TOTAL');
            const hasDataChar = cols.some(c => c.text.length > 0 && !['TOTAL','합계'].includes(c.text));
            if (isMeta || isTotal || !hasDataChar) return;

            // 4. 스타일/컬러 추출 (근접 좌표 기반)
            const stItem = cols.find(c => colMap.style !== -1 ? Math.abs(c.x - colMap.style) < 2.5 : (c.x > 2 && c.x < 8));
            if (stItem && stItem.text.length >= 3) curStyle = stItem.text;

            const clItem = cols.find(c => colMap.color !== -1 ? Math.abs(c.x - colMap.color) < 3.5 : (c.x > 7 && c.x < 15));
            if (clItem) {
                let r = clItem.text;
                const splitters = [' - ', ' / ', ' (', '-', '/', '('];
                let found = false;
                for (const s of splitters) {
                    if (r.includes(s)) {
                        let pts = r.split(s).map(p => p.trim());
                        if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curColor = pts[0]; curName = pts.slice(1).join(s).replace(')', '').trim(); }
                        else { curName = pts[0]; curColor = pts.slice(1).join(s).replace(')', '').trim(); }
                        found = true; break;
                    }
                }
                if (!found) {
                    const fc = COLORS.find(cl => r.toUpperCase().includes(cl));
                    if (fc) { curColor = fc; curName = r.replace(fc, '').replace(/^[\s\-\/]+/, '').trim() || curStyle; }
                    else { curName = r; }
                }
            }

            // TOTAL CTNS (박스수) 추출
            const bItem = cols.find(c => colMap.totalCtns !== -1 ? Math.abs(c.x - colMap.totalCtns) < 1.5 : (c.x > 20 && c.x < 24));
            const activeRowBoxes = bItem ? (parseInt(bItem.text) || 1) : 1;

            // 5. 수량 추출 및 최종 취합
            if (colMap.sizes.length === 0) {
                 // 사이즈가 안 잡혔을 경우 기본 위치 수량이라도 탐색
                 cols.filter(c => c.x > 10 && c.x < 30 && /^[0-9]+$/.test(c.text)).forEach(c => {
                    let q = parseInt(c.text) || 0;
                    if (q > 0) results.push({ style: curStyle, name: curName || curStyle, color: curColor, size: '?', qty: q * activeRowBoxes });
                 });
            } else {
                colMap.sizes.forEach(sz => {
                    const qItem = cols.find(c => Math.abs(c.x - sz.x) < 1.0);
                    if (qItem) {
                        let q = parseInt(qItem.text.replace(/[^0-9]/g,'')) || 0;
                        if (q > 0) results.push({ style: curStyle, name: curName || curStyle, color: curColor, size: sz.name, qty: q * activeRowBoxes });
                    }
                });
            }
          });
        });

        // 6. 결과 합산 및 정렬
        const aggregated: Record<string, PackingResult> = {};
        results.forEach(res => {
            const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
            if (aggregated[key]) aggregated[key].qty += res.qty;
            else aggregated[key] = { ...res };
        });
        
        const finalResults = Object.values(aggregated).sort((a,b) => a.style.localeCompare(b.style));

        // 7. 엑셀 워크북 생성
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Packing List');
        sheet.columns = [
            { header: 'STYLE NO', key: 'style', width: 25 },
            { header: '상품명', key: 'name', width: 35 },
            { header: '색상', key: 'color', width: 20 },
            { header: '사이즈', key: 'size', width: 12 },
            { header: '총수량', key: 'qty', width: 12 }
        ];
        
        const hRow = sheet.getRow(1);
        hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        hRow.alignment = { horizontal: 'center' };

        let gTotal = 0;
        finalResults.forEach(res => {
            sheet.addRow(res);
            gTotal += res.qty;
        });

        const tRow = sheet.addRow({ style: '총 합계', qty: gTotal });
        tRow.font = { bold: true };
        tRow.getCell('qty').font = { color: { argb: 'FFFF0000' }, bold: true };
        
        sheet.eachRow(row => {
            row.eachCell(cell => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        resolve(workbook);
      } catch(e) { reject(e); }
    });
    pdfParser.parseBuffer(buffer);
  });
}
