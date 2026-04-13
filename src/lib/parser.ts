import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

export interface PackingResult {
    style: string;
    name: string;
    color: string;
    size: string;
    qty: number;
}

const COLORS = ['BLACK','IVORY','WHITE', 'RED', 'BLUE', 'PINK', 'BROWN', 'NAVY', 'GREEN', 'YELLOW', 'BEIGE', 'GRAY', 'GREY', 'ORANGE', 'GOLD', 'SILVER', 'PURPLE', 'KHAKI', 'MINT', 'MELANGE', 'CHARCOAL', 'WINE', 'COCOA', 'LAVENDER', 'CORAL', 'PEACH'];

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)();
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            try {
                const results: PackingResult[] = [];
                let sizes: Record<number, string> = {}; 
                let curS = "", curN = "", curC = "";
                let curBoxes = 1;

                pdfData.Pages.forEach((page: any) => {
                    const rowsRaw: Record<number, any[]> = {};
                    page.Texts.forEach((t: any) => {
                        let txt = "";
                        try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                        if (!txt) return;
                        
                        const y = t.y;
                        const targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.4);
                        if (targetY) rowsRaw[parseFloat(targetY)].push({ x: t.x, text: txt });
                        else rowsRaw[y] = [{ x: t.x, text: txt }];
                    });

                    const sortedY = Object.keys(rowsRaw).sort((a, b) => Number(a) - Number(b));
                    sortedY.forEach(ry => {
                        const cols = rowsRaw[parseFloat(ry)].sort((a, b) => a.x - b.x);
                        const isMetaRow = cols.some(c => ['PAGE', 'SUB', 'PER', 'WEIGHT', 'DATE', 'INVOICE', 'TOTAL', 'NET', 'GROSS'].some(k => c.text.toUpperCase().includes(k)));
                        
                        const ctnF = cols.find(c => c.x > 0.5 && c.x < 2.0 && /^[0-9]+$/.test(c.text));
                        const ctnT = cols.find(c => c.x >= 2.0 && c.x < 3.5 && /^[0-9]+$/.test(c.text));
                        
                        const hasQtyData = cols.some(c => c.x >= 10.0 && c.x < 21.5 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                        const styleInZone = cols.find(c => c.x >= 3.5 && c.x < 6.5 && c.text.length >= 3);
                        const isDataRow = !!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3);

                        if (isDataRow && !isMetaRow) {
                            if (styleInZone) curS = styleInZone.text;
                            
                            const dataCand = cols.find(c => c.x >= 6.5 && c.x < 12.0);
                            if (dataCand) {
                                const r = dataCand.text;
                                if (r.includes(' - ')) {
                                    const pts = r.split(' - ').map(p=>p.trim());
                                    if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                                    else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                                } else if (r.includes('-')) {
                                    const pts = r.split('-').map(p=>p.trim());
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
                                const sxNum = parseFloat(sx);
                                if (sxNum < 10.0 || sxNum > 21.5) return;
                                const qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.0);
                                if (qtyCol) {
                                    const q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                                    if (q > 0 && q < 500) {
                                        results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sxNum], qty: q * curBoxes });
                                    }
                                }
                            });
                        } else if (!isMetaRow) {
                            const potSizes = cols.filter(c => 
                                c.x > 10.0 && c.x < 21.5 && 
                                c.text.length <= 8 && 
                                !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN'].some(k => c.text.toUpperCase().includes(k)) &&
                                /^[0-9A-Z\/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
                            );
                            if (potSizes.length >= 2 && !styleInZone) {
                                sizes = {}; 
                                potSizes.forEach(sc => { sizes[sc.x] = sc.text; });
                            }
                        }
                    });
                });

                // Aggregation
                const aggregated: Record<string, PackingResult> = {};
                results.forEach(res => {
                    const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
                    if (aggregated[key]) {
                        aggregated[key].qty += res.qty;
                    } else {
                        aggregated[key] = { ...res };
                    }
                });
                
                const finalResults = Object.values(aggregated).sort((a,b) => a.style.localeCompare(b.style));

                // Create Excel
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
