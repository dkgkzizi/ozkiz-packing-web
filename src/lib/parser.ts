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

/**
 * 모든 인도 패킹리스트 레이아웃을 소화할 수 있는 범용 고성능 파서입니다.
 * 좌표 유연성과 헤더 인식 로직을 극대화했습니다.
 */
export async function getRawPackingResults(buffer: Buffer): Promise<PackingResult[]> {
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
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.45);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                let fullText = cols.map(c => c.text.toUpperCase()).join(' ');
                
                // --- 1. 사이즈 헤더 감지 (데이터 행 여부와 관계없이 상시 감지) ---
                let potSizes = cols.filter(c => 
                    c.x > 10.0 && c.x < 35.0 && c.text.length <= 10 && 
                    !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN','NT.WT','GR.WT','KGS','DATE'].some(k => c.text.toUpperCase().includes(k)) &&
                    /^[0-9A-Z/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
                );
                // 스타일 번호가 없고, 사이즈 같은 숫자/글자가 2개 이상 보이면 사이즈 행으로 간주
                if (potSizes.length >= 2 && !cols.some(c => c.x < 10.0 && c.text.length > 5)) {
                    sizes = {}; 
                    potSizes.forEach(sc => { sizes[sc.x] = sc.text; });
                    return; // 사이즈 행은 데이터 행으로 처리하지 않음
                }

                // --- 2. 데이터 행 처리 ---
                const isMetaRow = (
                    fullText.includes('TOTAL') && (fullText.includes('KGS') || fullText.includes('PCS') || fullText.includes('CTNS')) ||
                    fullText.includes('PAGE ') || fullText.includes('DATE :') || fullText.includes('WEIGHT')
                );

                // 좌표 유연화: ctnF, ctnT, styleInZone 범위를 넓힘
                let ctnF = cols.find(c => c.x > 0.0 && c.x < 3.0 && /^[0-9]+$/.test(c.text));
                let ctnT = cols.find(c => c.x >= 1.5 && c.x < 5.0 && /^[0-9]+$/.test(c.text));
                let styleInZone = cols.find(c => c.x >= 3.0 && c.x < 8.0 && c.text.length >= 3);
                let hasQtyData = cols.some(c => c.x >= 10.0 && c.x < 35.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                
                let isDataRow = !!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3);

                if (isDataRow && !isMetaRow) {
                    if (styleInZone) curS = styleInZone.text;
                    
                    // 상품명/색상 추출 (좌표 범위 확장)
                    let dataCand = cols.find(c => c.x >= 6.0 && c.x < 15.0 && c.text.length > 3);
                    if (dataCand) {
                        let r = dataCand.text;
                        if (r.includes(' - ')) {
                            let pts = r.split(' - ').map(p=>p.trim());
                            if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                            else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                        } else if (r.includes('-')) {
                            let pts = r.split('-').map(p=>p.trim());
                            if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join('-').trim(); }
                            else { curN = pts[0]; curC = pts.slice(1).join('-').trim(); }
                        } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                            curC = r;
                        } else {
                            curN = r;
                        }
                    }
                    
                    if (ctnF && ctnT) {
                        let vF = parseInt(ctnF.text) || 0, vT = parseInt(ctnT.text) || 0;
                        curBoxes = (vT - vF + 1); if (curBoxes <= 0) curBoxes = 1;
                    }

                    Object.keys(sizes).forEach(sx => {
                        let sxNum = parseFloat(sx);
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.2); // 허용 오차 1.2로 확대
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                            if (q > 0 && q < 1000) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * curBoxes });
                            }
                        }
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

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const results = await getRawPackingResults(buffer);
  
  const aggregated: Record<string, any> = {};
  results.forEach(res => {
      const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
      if (aggregated[key]) aggregated[key].qty += res.qty;
      else aggregated[key] = { ...res };
  });
  
  const finalResults = Object.values(aggregated).sort((a: any, b: any) => a.style.localeCompare(b.style));

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
      totalQty += (res as any).qty;
  });

  const totalRow = worksheet.addRow({ style: '총 합계', qty: totalQty });
  totalRow.font = { bold: true };
  totalRow.getCell('qty').font = { color: { argb: 'FFFF0000' }, bold: true };
  
  worksheet.eachRow(row => {
      row.eachCell(cell => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
  });

  return workbook;
}
// Final Universal fix: 1776137037629