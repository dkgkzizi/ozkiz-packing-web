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
            
            const results: PackingResult[] = [];
            let curS = "", curN = "", curC = "", curBoxes = 1;
            let sizes: Record<number, string> = {};

            data?.pages.forEach((page: any) => {
                const rowsRaw: Record<number, any[]> = {};
                page.content.forEach((item: any) => {
                    const y = Math.round(item.y * 10) / 10;
                    if (!rowsRaw[y]) rowsRaw[y] = [];
                    rowsRaw[y].push({ x: item.x, text: item.str });
                });

                const sortedY = Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b));
                sortedY.forEach(ry => {
                    const cols = rowsRaw[Number(ry)].sort((a,b) => a.x - b.x);
                    
                    // 1. 사이즈 헤더(100, 110 등) 상시 감지 - 어떤 줄에서든 감지되면 업데이트
                    const potSizes = cols.filter(c => 
                        c.x > 8.5 && c.x < 22.0 && 
                        /^[0-9]+$/.test(c.text.trim()) &&
                        parseInt(c.text.trim()) >= 80 && parseInt(c.text.trim()) <= 200
                    );
                    if (potSizes.length >= 2) {
                        sizes = {};
                        potSizes.forEach(sc => { sizes[sc.x] = sc.text.trim(); });
                    }

                    // 2. 데이터 유효성 판단 요소들
                    const ctnF = cols.find(c => c.x > 0.4 && c.x < 2.5 && /^[0-9]+$/.test(c.text.trim()));
                    const ctnT = cols.find(c => c.x >= 2.0 && c.x < 4.5 && /^[0-9]+$/.test(c.text.trim()));
                    const styleInZone = cols.find(c => c.x >= 3.0 && c.x < 8.0 && c.text.length >= 3);
                    const hasQtyData = cols.some(c => c.x >= 9.5 && c.x < 22.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                    
                    const isMeta = cols.some(c => ['PAGE', 'SUB', 'WEIGHT', 'DATE', 'PACKING', 'LIST'].some(k => c.text.toUpperCase().includes(k)));
                    // 박스 번호(ctnF)가 있으면 TOTAL 글자가 있어도 데이터로 간주 (중요: DPL-052 마지막 1000개 수량 확보를 위함)
                    const isTotalSumRow = cols.some(c => c.text.toUpperCase() === 'TOTAL' || c.text === '총 합계') && !ctnF;

                    // 3. 데이터 추출 실행
                    if (!isMeta && !isTotalSumRow && (ctnF || styleInZone || hasQtyData)) {
                        // 스타일 번호 갱신
                        if (styleInZone && !/^[0-9\s-]+$/.test(styleInZone.text)) {
                            curS = styleInZone.text.trim();
                        }

                        // 상품명 및 색상 갱신
                        let dataCand = cols.find(c => c.x >= 6.0 && c.x < 12.0 && c.text.length > 3);
                        if (dataCand) {
                            let r = dataCand.text;
                            if (r.includes(' - ')) {
                                let pts = r.split(' - ').map((p: string)=>p.trim());
                                if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                                else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                            } else if (r.includes('-')) {
                                let pts = r.split('-').map((p: string)=>p.trim());
                                if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join('-').trim(); }
                                else { curN = pts[0]; curC = pts.slice(1).join('-').trim(); }
                            } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) {
                                curC = r;
                            } else {
                                curN = r;
                            }
                        }

                        // 박스 수량 갱신
                        if (ctnF && ctnT) {
                            let vF = parseInt(ctnF.text) || 0, vT = parseInt(ctnT.text) || 0;
                            curBoxes = Math.abs(vT - vF) + 1;
                            if (curBoxes <= 0 || isNaN(curBoxes)) curBoxes = 1;
                        }

                        // 사이즈별 수량 매칭
                        Object.keys(sizes).forEach(sx => {
                            const sxNum = parseFloat(sx);
                            const qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.3);
                            if (qtyCol) {
                                const q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                                if (q > 0) {
                                    results.push({ 
                                        style: curS, 
                                        name: curN || curS, 
                                        color: curC, 
                                        size: sizes[sxNum], 
                                        qty: q * curBoxes 
                                    });
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
