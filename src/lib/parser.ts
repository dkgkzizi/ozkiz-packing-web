import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';
import ExcelJS from 'exceljs';

export interface PackingResult {
    style: string;
    name: string;
    color: string;
    size: string;
    qty: number;
}

const COLORS = [
    'IVORY', 'WHITE', 'BLACK', 'PINK', 'YELLOW', 'MELANGE', 'GRAY', 'GREY', 'BEIGE', 'BLUE', 'NAVY', 
    'RED', 'GREEN', 'MINT', 'PURPLE', 'CHARCOAL', 'CORAL', 'PEACH', 'BROWN', 'WINE', 'LAVENDER', 
    'KHAKI', 'G MEL', 'DENIM', 'CREAM', 'OATMEAL', 'COCOA', 'LIME', 'ORANGE', 'GOLD', 'SILVER'
];

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
                    // Improved row grouping with tolerance
                    const y = item.y;
                    const existingY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.5);
                    if (existingY) {
                        rowsRaw[parseFloat(existingY)].push({ x: item.x, text: item.str });
                    } else {
                        rowsRaw[y] = [{ x: item.x, text: item.str }];
                    }
                });

                const sortedY = Object.keys(rowsRaw).sort((a, b) => Number(a) - Number(b));
                sortedY.forEach(ry => {
                    const ryNum = Number(ry);
                    const cols = rowsRaw[ryNum].sort((a,b) => a.x - b.x);
                    
                    // 1. Detect size headers - broaden search and include alpha sizes
                    const potSizes = cols.filter(c => 
                        c.x > 7.0 && c.x < 25.0 && 
                        (
                          (/^[0-9]+$/.test(c.text.trim()) && parseInt(c.text.trim()) >= 10 && parseInt(c.text.trim()) <= 400) ||
                          (['S', 'M', 'L', 'XL', 'XXL', 'FREE', 'F', '90', '100', '110', '120', '130', '140', '150'].includes(c.text.trim().toUpperCase())) ||
                          (/^[0-9]+\/[0-9]+$/.test(c.text.trim()))
                        )
                    );
                    
                    // Only update sizes if it looks like a header row (many sizes, no CTN data)
                    const tempCtnF = cols.find(c => c.x > 0.1 && c.x < 3.0 && /^[0-9]+$/.test(c.text.trim()));
                    const isMetaRow = cols.some(c => ['STYLE', 'COLOR', 'NAME', 'PRODUCT'].some(k => c.text.toUpperCase().includes(k)));
                    
                    if (potSizes.length >= 2 && !tempCtnF) {
                        sizes = {};
                        potSizes.forEach(sc => { 
                            sizes[sc.x] = sc.text.trim(); 
                        });
                    }

                    // 2. Data analysis
                    const ctnF = cols.find(c => c.x > 0.1 && c.x < 2.5 && /^[0-9]+$/.test(c.text.trim()));
                    const ctnT = cols.find(c => c.x >= 1.5 && c.x < 4.5 && /^[0-9]+$/.test(c.text.trim()));
                    
                    // Style detection - loosed constraints
                    const styleInZone = cols.find(c => c.x >= 2.5 && c.x < 10.0 && c.text.length >= 2 && !/^\d+$/.test(c.text));
                    
                    const isMeta = cols.some(c => ['PAGE', 'SUB', 'WEIGHT', 'DATE', 'PACKING', 'LIST', 'INVOICE', 'SHIP', 'TO', 'PER'].some(k => c.text.toUpperCase().includes(k)));
                    const isTotalSumRow = cols.some(c => c.text.toUpperCase().includes('TOTAL') || c.text.includes('합계')) && !ctnF;

                    if (!isMeta && !isTotalSumRow && !isMetaRow) {
                        if (styleInZone) {
                            curS = styleInZone.text.trim();
                        }

                        // Extract name and color
                        const nameColorCand = cols.find(c => c.x >= 4.0 && c.x < 15.0 && c.text.length > 1);
                        if (nameColorCand) {
                            const text = nameColorCand.text.trim();
                            const splitters = [' - ', ' / ', '(', ' -', '- ']; // Flexible separators
                            let splitFound = false;
                            
                            for (const s of splitters) {
                                if (text.includes(s)) {
                                    const parts = text.split(s).map(p => p.trim());
                                    if (COLORS.some(cl => parts[0].toUpperCase().includes(cl)) || COLORS.some(cl => parts[1]?.toUpperCase().includes(cl))) {
                                        if (COLORS.some(cl => parts[0].toUpperCase().includes(cl))) {
                                            curC = parts[0];
                                            curN = parts.slice(1).join(s).replace(')', '').trim();
                                        } else {
                                            curN = parts[0];
                                            curC = parts.slice(1).join(s).replace(')', '').trim();
                                        }
                                        splitFound = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!splitFound) {
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
                                    // If we don't have name/color yet, try to find it in the same row
                                    const localNameCand = cols.find(c => c.x >= 4.0 && c.x < 15.0 && c.text.length > 1);
                                    
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
