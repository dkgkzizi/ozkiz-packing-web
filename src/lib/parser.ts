import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';
import ExcelJS from 'exceljs';

export interface PackingResult {
    style: string;
    name: string;
    color: string;
    size: string;
    qty: number;
}

const COLORS = ['IVORY', 'WHITE', 'BLACK', 'PINK', 'YELLOW', 'MELANGE', 'GRAY', 'BEIGE', 'BLUE', 'NAVY', 'RED', 'GREEN', 'MINT', 'PURPLE', 'CHARCOAL', 'CORAL', 'PEACH', 'BROWN', 'WINE', 'LAVENDER', 'KHAKI', 'G MEL', 'DENIM', 'CREAM', 'OATMEAL', 'COCOA', 'MINT', 'LIME'];

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const pdfExtract = new PDFExtract();
    const options: PDFExtractOptions = {};
    
    return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, options, async (err: Error | null, data?: any) => {
            if (err) return reject(err);
            if (!data) {
                const emptyWb = new ExcelJS.Workbook();
                emptyWb.addWorksheet('No Data');
                return resolve(emptyWb);
            }
            
            const results: PackingResult[] = [];
            let curS = "";
            let curN = "";
            let curC = "";
            let curBoxes = 1;
            let sizes: Record<number, string> = {};

            data.pages.forEach((page: any) => {
                const rowsRaw: Record<number, any[]> = {};
                page.content.forEach((item: any) => {
                    // Normalize Y coordinates by rounding to 1 decimal place
                    const y = Math.round(item.y * 10) / 10;
                    if (!rowsRaw[y]) rowsRaw[y] = [];
                    rowsRaw[y].push({ x: item.x, text: item.str });
                });

                const sortedY = Object.keys(rowsRaw).sort((a, b) => Number(a) - Number(b));
                sortedY.forEach(ry => {
                    const ryNum = Number(ry);
                    const cols = rowsRaw[ryNum].sort((a,b) => a.x - b.x);
                    
                    // 1. Detect size headers (80 - 200 range)
                    const potSizes = cols.filter(c => 
                        c.x > 8.0 && c.x < 24.0 && 
                        /^[0-9]+$/.test(c.text.trim()) &&
                        parseInt(c.text.trim()) >= 70 && parseInt(c.text.trim()) <= 200
                    );
                    
                    if (potSizes.length >= 2) {
                        sizes = {};
                        potSizes.forEach(sc => { 
                            // Store size by X position
                            sizes[sc.x] = sc.text.trim(); 
                        });
                    }

                    // 2. Data analysis
                    // CTN FROM/TO columns are often at the far left
                    const ctnF = cols.find(c => c.x > 0.3 && c.x < 3.0 && /^[0-9]+$/.test(c.text.trim()));
                    const ctnT = cols.find(c => c.x >= 2.0 && c.x < 5.0 && /^[0-9]+$/.test(c.text.trim()));
                    
                    // Style is usually after CTN columns
                    const styleInZone = cols.find(c => c.x >= 3.5 && c.x < 9.0 && c.text.length >= 3 && !/^\d+$/.test(c.text));
                    
                    const isMeta = cols.some(c => ['PAGE', 'SUB', 'WEIGHT', 'DATE', 'PACKING', 'LIST', 'INVOICE'].some(k => c.text.toUpperCase().includes(k)));
                    const isTotalSumRow = cols.some(c => c.text.toUpperCase().includes('TOTAL') || c.text.includes('합계')) && !ctnF;

                    if (!isMeta && !isTotalSumRow) {
                        if (styleInZone) {
                            curS = styleInZone.text.trim();
                        }

                        // Extract name and color - often adjacent or in a specific zone
                        const nameColorCand = cols.find(c => c.x >= 5.0 && c.x < 13.0 && c.text.length > 2);
                        if (nameColorCand) {
                            const text = nameColorCand.text.trim();
                            if (text.includes(' - ')) {
                                const parts = text.split(' - ');
                                if (COLORS.some(cl => parts[0].toUpperCase().includes(cl))) {
                                    curC = parts[0].trim();
                                    curN = parts.slice(1).join(' - ').trim();
                                } else {
                                    curN = parts[0].trim();
                                    curC = parts.slice(1).join(' - ').trim();
                                }
                            } else {
                                // Fallback: check if the string contains a color
                                const foundColor = COLORS.find(cl => text.toUpperCase().includes(cl));
                                if (foundColor) {
                                    curC = text;
                                } else if (text.length > 5) {
                                    curN = text;
                                }
                            }
                        }

                        if (ctnF && ctnT) {
                            const vF = parseInt(ctnF.text) || 1;
                            const vT = parseInt(ctnT.text) || vF;
                            curBoxes = Math.abs(vT - vF) + 1;
                        }

                        // Check each detected size column for a quantity
                        Object.entries(sizes).forEach(([sx, sVal]) => {
                            const sxNum = parseFloat(sx);
                            const qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.0);
                            if (qtyCol) {
                                const q = parseInt(qtyCol.text.replace(/[^0-9]/g, '')) || 0;
                                if (q > 0) {
                                    results.push({ 
                                        style: curS, 
                                        name: curN || curS, 
                                        color: curC, 
                                        size: sVal, 
                                        qty: q * curBoxes 
                                    });
                                }
                            }
                        });
                    }
                });
            });

            // Create Excel Workbook
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Packing List');
            
            sheet.columns = [
                { header: 'STYLE NO', key: 'style', width: 20 },
                { header: 'PRODUCT NAME', key: 'name', width: 40 },
                { header: 'COLOR', key: 'color', width: 15 },
                { header: 'SIZE', key: 'size', width: 10 },
                { header: 'QTY', key: 'qty', width: 10 }
            ];

            // Style headers
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
            headerRow.alignment = { horizontal: 'center' };

            results.forEach(res => {
                sheet.addRow(res);
            });

            // Simple styling for content
            sheet.eachRow((row, rowNum) => {
                if (rowNum > 1) {
                    row.eachCell(cell => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                }
            });

            resolve(workbook);
        });
    });
}
