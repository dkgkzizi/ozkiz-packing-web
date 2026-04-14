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
 * 대용량 및 멀티 페이지 PDF 대응을 위해 강화된 파서입니다.
 * 필터링 로직을 완화하고 헤더 인식의 견고함을 높였습니다.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: any[] = [];
        let sizes: Record<string, string> = {}; 
        let curS = "", curN = "", curC = "";
        let curBoxes = 1;

        // 모든 페이지를 순차적으로 처리
        pdfData.Pages.forEach((page: any) => {
            let rowsRaw: Record<string, any[]> = {};
            page.Texts.forEach((t: any) => {
                let txt = "";
                try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                if (!txt) return;
                
                let y = t.y;
                // y좌표 오차 범위를 0.5로 약간 넓혀 데이터 누락 방지
                let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.5);
                if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                else rowsRaw[y] = [{ x: t.x, text: txt }];
            });

            let sortedY = Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b));
            sortedY.forEach(ry => {
                let cols = rowsRaw[ry].sort((a,b) => a.x - b.x);
                
                // MetaRow 필터 완화: 텍스트가 많은 경우 합계행으로 오인하지 않도록 조건 강화
                const fullLineText = cols.map(c => c.text.toUpperCase()).join(' ');
                const isMetaRow = (
                    (fullLineText.includes('TOTAL') && (fullLineText.includes('KGS') || fullLineText.includes('GROSS') || fullLineText.includes('NET'))) ||
                    fullLineText.includes('PAGE ') ||
                    fullLineText.includes('DATE :')
                );
                
                let ctnF = cols.find(c => c.x > 0.5 && c.x < 2.0 && /^[0-9]+$/.test(c.text));
                let ctnT = cols.find(c => c.x >= 2.0 && c.x < 3.5 && /^[0-9]+$/.test(c.text));
                
                let hasQtyData = cols.some(c => c.x >= 10.0 && c.x < 21.5 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                let styleInZone = cols.find(c => c.x >= 3.5 && c.x < 6.5 && c.text.length >= 3);
                
                // 데이터 행 판단 기준: 스타일 번호가 있거나, 수량 데이터가 확실히 있는 경우
                let isDataRow = !!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3);

                if (isDataRow && !isMetaRow) {
                    if (styleInZone) curS = styleInZone.text;
                    
                    let dataCand = cols.find(c => c.x >= 6.5 && c.x < 12.0);
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
                        if (sxNum < 10.0 || sxNum > 21.5) return;
                        let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.0);
                        if (qtyCol) {
                            let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                            if (q > 0) {
                                results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sx], qty: q * curBoxes });
                            }
                        }
                    });
                } else {
                    // 사이즈 헤더 인식 (isMetaRow에 관계없이 감지 가능하도록 하여 누락 방지)
                    let potSizes = cols.filter(c => 
                        c.x > 10.0 && c.x < 21.5 && 
                        c.text.length <= 8 && 
                        !['QTY','PCS','TOTAL','PER','BOX','CTN'].some(k => c.text.toUpperCase() === k) &&
                        /^[0-10A-Z\/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
                    );
                    if (potSizes.length >= 2 && !styleInZone) {
                        sizes = {}; 
                        potSizes.forEach(sc => { sizes[sc.x] = sc.text; });
                    }
                }
            });
        });

        // 수량 합산
        const aggregated: Record<string, any> = {};
        results.forEach(res => {
            const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
            if (aggregated[key]) {
                aggregated[key].qty += res.qty;
            } else {
                aggregated[key] = { ...res };
            }
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

        resolve(workbook);
      } catch(e) { reject(e); }
    });

    pdfParser.parseBuffer(buffer);
  });
}
