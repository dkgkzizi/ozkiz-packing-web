import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';

export interface PackingResult {
    style: string;
    name: string;
    color: string;
    size: string;
    qty: number;
}

const COLORS = ['IVORY', 'WHITE', 'BLACK', 'PINK', 'YELLOW', 'MELANGE', 'GRAY', 'BEIGE', 'BLUE', 'NAVY', 'RED', 'GREEN', 'MINT', 'PURPLE', 'CHARCOAL', 'CORAL', 'PEACH', 'BROWN', 'WINE', 'LAVENDER', 'KHAKI', 'G MEL', 'DENIM'];

export async function parsePdfBuffer(buffer: Buffer): Promise<PackingResult[]> {
    const pdfExtract = new PDFExtract();
    const options: PDFExtractOptions = {};
    
    return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, options, (err: Error | null, data?: any) => {
            if (err) return reject(err);
            if (!data) return resolve([]);
            
            const results: PackingResult[] = [];
            let curS = "", curN = "", curC = "", curBoxes = 1;
            let sizes: Record<number, string> = {};

            data.pages.forEach((page: any) => {
                const rowsRaw: Record<number, any[]> = {};
                page.content.forEach((item: any) => {
                    const y = Math.round(item.y * 10) / 10;
                    if (!rowsRaw[y]) rowsRaw[y] = [];
                    rowsRaw[y].push({ x: item.x, text: item.str });
                });

                const sortedY = Object.keys(rowsRaw).sort((a, b) => Number(a) - Number(b));
                sortedY.forEach(ry => {
                    const ryNum = Number(ry);
                    const cols = rowsRaw[ryNum].sort((a,b) => a.x - b.x);
                    
                    // 1. 사이즈 헤더 감지
                    const potSizes = cols.filter(c => 
                        c.x > 8.5 && c.x < 22.0 && 
                        /^[0-9]+$/.test(c.text.trim()) &&
                        parseInt(c.text.trim()) >= 80 && parseInt(c.text.trim()) <= 200
                    );
                    if (potSizes.length >= 2) {
                        sizes = {};
                        potSizes.forEach(sc => { sizes[sc.x] = sc.text.trim(); });
                    }

                    // 2. 데이터 분석
                    const ctnF = cols.find(c => c.x > 0.4 && c.x < 2.5 && /^[0-9]+$/.test(c.text.trim()));
                    const ctnT = cols.find(c => c.x >= 2.0 && c.x < 4.5 && /^[0-9]+$/.test(c.text.trim()));
                    const styleInZone = cols.find(c => c.x >= 3.0 && c.x < 8.0 && c.text.length >= 3);
                    const hasQtyData = cols.some(c => c.x >= 9.5 && c.x < 22.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g, '')));
                    
                    const isMeta = cols.some(c => ['PAGE', 'SUB', 'WEIGHT', 'DATE', 'PACKING', 'LIST'].some(k => c.text.toUpperCase().includes(k)));
                    const isTotalSumRow = cols.some(c => c.text.toUpperCase() === 'TOTAL' || c.text === '총 합계') && !ctnF;

                    if (!isMeta && !isTotalSumRow && (ctnF || styleInZone || hasQtyData)) {
                        if (styleInZone && !/^[0-9\s-]+$/.test(styleInZone.text)) {
                            curS = styleInZone.text.trim();
                        }

                        const dataCand = cols.find(c => c.x >= 6.0 && c.x < 12.0 && c.text.length > 3);
                        if (dataCand) {
                            const r = dataCand.text;
                            if (r.includes(' - ')) {
                                const pts = r.split(' - ').map((p: string) => p.trim());
                                if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                                else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                            } else if (r.includes('-')) {
                                const pts = r.split('-').map((p: string) => p.trim());
                                if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join('-').trim(); }
                                else { curN = pts[0]; curC = pts.slice(1).join('-').trim(); }
                            } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                                curC = r;
                            } else {
                                curN = r;
                            }
                        }

                        if (ctnF && ctnT) {
                            const vF = parseInt(ctnF.text) || 0, vT = parseInt(ctnT.text) || 0;
                            curBoxes = Math.abs(vT - vF) + 1;
                        }

                        Object.keys(sizes).forEach(sx => {
                            const sxNum = parseFloat(sx);
                            const qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.3);
                            if (qtyCol) {
                                const q = parseInt(qtyCol.text.replace(/[^0-9]/g, '')) || 0;
                                if (q > 0) {
                                    results.push({ style: curS, name: curN || curS, color: curC, size: sizes[sxNum], qty: q * curBoxes });
                                }
                            }
                        });
                    }
                });
            });
            resolve(results);
        });
    });
}
