import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

const COLORS = ['BLACK','IVORY','WHITE','RED','BLUE','PINK','BROWN','NAVY','GREEN','YELLOW','BEIGE','GRAY','GREY','ORANGE','YELLOW','GOLD','SILVER','PURPLE','KHAKI','MINT','MELANGE','CHARCOAL','WINE','COCOA','LAVENDER','CORAL','PEACH'];

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
            // 초기 성공 버전과 동일한 허용 오차 0.4 적용
            let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.4);
            if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
            else rowsRaw[y] = [{ x: t.x, text: txt }];
          });

          let sortedY = Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b));
          sortedY.forEach(ry => {
            let cols = rowsRaw[ry].sort((a,b) => a.x - b.x);
            
            // 데이터인지 확인하는 기준 (박스 번호나 스타일, 수량이 보이면 데이터로 간주)
            let ctnF = cols.find(c => c.x > 0.4 && c.x < 2.5 && /^[0-9]+$/.test(c.text.trim()));
            let ctnT = cols.find(c => c.x >= 2.0 && c.x < 5.0 && /^[0-9]+$/.test(c.text.trim()));
            let hasQtyData = cols.some(c => c.x >= 9.5 && c.x < 25.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
            let styleInZone = cols.find(c => c.x >= 3.0 && c.x < 10.0 && c.text.length >= 3);
            
            const isMeta = cols.some(c => ['PAGE', 'SUB', 'WEIGHT', 'INVOICE', 'DATE'].some(k => c.text.toUpperCase().includes(k)));
            const isTotal = cols.some(c => c.text.toUpperCase() === 'TOTAL' || c.text === '총 합계' || c.text === '합계');
            
            let isDataRow = (!!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3)) && !isTotal && !isMeta;

            if (isDataRow) {
              if (styleInZone) curS = styleInZone.text;
              
              let dataCand = cols.find(c => c.x >= 6.0 && c.x < 13.0);
              if (dataCand) {
                let r = dataCand.text;
                if (r.includes(' - ')) {
                  let pts = r.split(' - ').map((p: string)=>p.trim());
                  if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                  else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                  curC = r;
                } else {
                  curN = r;
                }
              }
              
              // TOTAL CTNS 인식 로직 (스크린샷 기반)
              let totalCtnsCol = cols.find(c => c.x >= 20.0 && c.x < 24.0 && /^[0-9]+$/.test(c.text.trim()));
              if (totalCtnsCol) curBoxes = parseInt(totalCtnsCol.text.trim()) || 1;
              else if (ctnF && ctnT) {
                let vF = parseInt(ctnF.text) || 0, vT = parseInt(ctnT.text) || 0;
                curBoxes = (vT - vF + 1); 
              }

              Object.keys(sizes).forEach(sx => {
                let sxNum = parseFloat(sx);
                if (sxNum < 9.0 || sxNum > 25.0) return;
                let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.3);
                if (qtyCol) {
                  let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                  if (q > 0) {
                    results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * curBoxes });
                  }
                }
              });
            } else if (!isTotal && !isMeta) {
              // 사이즈 헤더 자동 감지 (100, 110 등)
              let potSizes = cols.filter(c => 
                c.x > 9.0 && c.x < 25.0 && 
                c.text.length <= 8 && 
                !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN'].some(k => c.text.toUpperCase().includes(k)) &&
                /^[0-9A-Z\/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
              );
              if (potSizes.length >= 2) {
                sizes = {}; 
                potSizes.forEach(sc => { sizes[sc.x] = sc.text; });
              }
            }
          });
        });

        const aggregated: Record<string, PackingResult> = {};
        results.forEach(res => {
          const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
          if (aggregated[key]) aggregated[key].qty += res.qty;
          else aggregated[key] = { ...res };
        });
        
        const finalResults = Object.values(aggregated).sort((a,b) => a.style.localeCompare(b.style));

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

        let totalQty = 0;
        finalResults.forEach(res => {
          worksheet.addRow(res);
          totalQty += res.qty;
        });

        const totalRow = worksheet.addRow({ style: '총 합계', qty: totalQty });
        totalRow.font = { bold: true };
        totalRow.getCell('qty').font = { color: { argb: 'FFFF0000' }, bold: true };
        
        worksheet.eachRow(row => {
          row.eachCell(cell => {
            cell.border = { top: {style:'thin' as any}, left: {style:'thin' as any}, bottom: {style:'thin' as any}, right: {style:'thin' as any} };
            cell.alignment = { horizontal: 'center' as any, vertical: 'middle' as any };
          });
        });

        resolve(workbook);
      } catch(e) { reject(e); }
    });

    pdfParser.parseBuffer(buffer);
  });
}
