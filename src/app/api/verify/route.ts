import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

// PDF 데이터 추출 로직
async function getPdfDetailedData(buffer: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)();
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            try {
                let results: any[] = [];
                let sizes: any = {}; 
                let curS = "", curN = "", curC = "";
                let curBoxes = 1;
                const COLORS = ['BLACK','IVORY','WHITE','RED','BLUE','PINK','BROWN','NAVY','GREEN','YELLOW','BEIGE','GRAY','GREY','ORANGE','YELLOW','GOLD','SILVER','PURPLE','KHAKI','MINT','MELANGE','CHARCOAL','WINE','COCOA','LAVENDER','CORAL','PEACH'];

                pdfData.Pages.forEach((page: any) => {
                    let rowsRaw: any = {};
                    page.Texts.forEach((t: any) => {
                        let txt = "";
                        try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
                        if (!txt) return;
                        let y = t.y;
                        let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.4);
                        if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
                        else rowsRaw[y] = [{ x: t.x, text: txt }];
                    });
                    let sortedY = Object.keys(rowsRaw).sort((a:any,b:any)=>Number(a)-Number(b));
                    sortedY.forEach(ry => {
                        let cols = rowsRaw[ry].sort((a:any,b:any) => a.x - b.x);
                        const isMetaRow = cols.some((c:any) => ['PAGE', 'SUB', 'PER', 'WEIGHT', 'DATE', 'INVOICE', 'TOTAL', 'NET', 'GROSS'].some(k => c.text.toUpperCase().includes(k)));
                        let ctnF = cols.find((c:any) => c.x > 0.5 && c.x < 2.0 && /^[0-9]+$/.test(c.text));
                        let ctnT = cols.find((c:any) => c.x >= 2.0 && c.x < 3.5 && /^[0-9]+$/.test(c.text));
                        let hasQtyData = cols.some((c:any) => c.x >= 10.0 && c.x < 21.5 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
                        let styleInZone = cols.find((c:any) => c.x >= 3.5 && c.x < 6.5 && c.text.length >= 3);
                        let isDataRow = !!(ctnF && ctnT) || (hasQtyData && !!styleInZone) || (hasQtyData && curS.length >= 3);
                        if (isDataRow && !isMetaRow) {
                            if (styleInZone) curS = styleInZone.text;
                            let dataCand = cols.find((c:any) => c.x >= 6.5 && c.x < 12.0);
                            if (dataCand) {
                                let r = dataCand.text;
                                if (r.includes(' - ')) {
                                    let pts = r.split(' - ').map((p:string)=>p.trim());
                                    if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join(' - ').trim(); }
                                    else { curN = pts[0]; curC = pts.slice(1).join(' - ').trim(); }
                                } else if (r.includes('-')) {
                                    let pts = r.split('-').map((p:string)=>p.trim());
                                    if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { curC = pts[0]; curN = pts.slice(1).join('-').trim(); }
                                    else { curN = pts[0]; curC = pts.slice(1).join('-').trim(); }
                                } else if (COLORS.some(cl => r.toUpperCase().includes(cl))) { curC = r; } else { curN = r; }
                            }
                            if (ctnF && ctnT) {
                                let vF = parseInt(ctnF.text) || 0, vT = parseInt(ctnT.text) || 0;
                                curBoxes = (vT - vF + 1); if (curBoxes <= 0) curBoxes = 1;
                            }
                            Object.keys(sizes).forEach(sx => {
                                let sxNum = parseFloat(sx);
                                if (sxNum < 10.0 || sxNum > 21.5) return;
                                let qtyCol = cols.find((c:any) => Math.abs(c.x - sxNum) < 1.0);
                                if (qtyCol) {
                                    let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                                    if (q > 0 && q < 500) results.push({ Style: curS, Name: curN || curS, Color: curC, Size: sizes[sx], Qty: q * curBoxes });
                                }
                            });
                        } else if (!isMetaRow) {
                            let potSizes = cols.filter((c:any) => c.x > 10.0 && c.x < 21.5 && c.text.length <= 8 && !['SIZE','QTY','PCS','TOTAL','PER','BOX','CTN'].some(k => c.text.toUpperCase().includes(k)) && /^[0-9A-Z\/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,'')));
                            if (potSizes.length >= 2 && !styleInZone) { sizes = {}; potSizes.forEach((sc:any) => { sizes[sc.x] = sc.text; }); }
                        }
                    });
                });
                let grouped: any = {};
                let total = 0;
                results.forEach(r => {
                    let k = `${r.Style}|${r.Name}|${r.Color}|${r.Size}`;
                    grouped[k] = (grouped[k] || 0) + r.Qty;
                    total += r.Qty;
                });
                resolve({ total, detailed: grouped });
            } catch(e) { reject(e); }
        });
        pdfParser.parseBuffer(buffer);
    });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const excelFile = formData.get('excel') as File;
    
    if (!pdfFile || !excelFile) {
      return NextResponse.json({ success: false, message: '두 파일이 모두 필요합니다.' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());

    const pdfData = await getPdfDetailedData(pdfBuffer);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);
    const sheet = workbook.worksheets[0];
    
    let excelTotal = 0, excelDetailed: any = {};
    let qtyColIdx = 5;
    let isMatchedFile = false;

    sheet.getRow(1).eachCell((cell, colNumber) => {
        const val = cell.text.trim();
        if (val === '작업수량') { qtyColIdx = colNumber; isMatchedFile = true; }
        else if (val === '총수량') { qtyColIdx = colNumber; isMatchedFile = false; }
    });

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const col1 = row.getCell(1).text.trim();
        if (!col1 || col1 === '총 합계') return;
        const qty = parseInt(row.getCell(qtyColIdx).value as any) || 0;
        
        if (isMatchedFile) {
            excelTotal += qty;
            const originalKeysStr = row.getCell(7).text.trim();
            originalKeysStr.split(';').forEach(k => { 
                if (k) {
                    excelDetailed[k] = { 
                        qty: qty, 
                        isAggregated: true,
                        // 매칭된 한글 상품명과 옵션을 저장합니다.
                        matchedName: row.getCell(2).text.trim(),
                        matchedOption: `${row.getCell(3).text.trim()} / ${row.getCell(4).text.trim()}`
                    }; 
                }
            });
        } else {
            excelTotal += qty;
            const key = `${col1}|${row.getCell(2).text.trim()}|${row.getCell(3).text.trim()}|${row.getCell(4).text.trim()}`;
            excelDetailed[key] = (excelDetailed[key] || 0) + qty;
        }
    });

    // Comparison logic
    const comparisons: any[] = [];
    Object.keys(pdfData.detailed).forEach(k => {
        const pdfQty = pdfData.detailed[k];
        const exData = excelDetailed[k];
        const exQty = typeof exData === 'number' ? exData : (exData?.qty || 0);
        
        // 표시용 라벨 결정: 매칭된 한글 정보가 있으면 그것을 쓰고, 없으면 기존 영문 정보를 씁니다.
        let label = k.split('|').join(' / ');
        if (exData && typeof exData !== 'number' && exData.matchedName) {
            label = `${exData.matchedName} / ${exData.matchedOption}`;
        }
        
        comparisons.push({ label: label, pdf: pdfQty, excel: exQty, isMatch: pdfQty === exQty });
    });

    return NextResponse.json({
      success: true,
      pdfTotal: pdfData.total,
      excelTotal: excelTotal,
      comparisons: comparisons,
      itemsMatch: comparisons.every(c => c.isMatch)
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
