import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getRawPackingResults } from '@/lib/parser';

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

    // 공통 파서를 사용하여 PDF 데이터 추출 (변환기와 100% 동일한 로직)
    const rawPdfResults = await getRawPackingResults(pdfBuffer);
    
    // PDF 데이터 집계
    let pdfTotal = 0;
    const pdfDetailed: Record<string, number> = {};
    rawPdfResults.forEach(r => {
        const key = `${r.style}|${r.name}|${r.color}|${r.size}`;
        pdfDetailed[key] = (pdfDetailed[key] || 0) + r.qty;
        pdfTotal += r.qty;
    });
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);
    const sheet = workbook.worksheets[0];
    
    let excelTotal = 0, excelDetailed: any = {};
    let qtyColIdx = 5;
    let isMatchedFile = false;

    // 헤더를 분석하여 파일 타입 파악 (단순 변환 파일 vs 매칭 완료 파일)
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

    const comparisons: any[] = [];
    Object.keys(pdfDetailed).forEach(k => {
        const pdfQty = pdfDetailed[k];
        const exData = excelDetailed[k];
        const exQty = typeof exData === 'number' ? exData : (exData?.qty || 0);
        
        let label = k.split('|').join(' / ');
        if (exData && typeof exData !== 'number' && exData.matchedName) {
            label = `${exData.matchedName} / ${exData.matchedOption}`;
        }
        
        comparisons.push({ label: label, pdf: pdfQty, excel: exQty, isMatch: pdfQty === exQty });
    });

    return NextResponse.json({
      success: true,
      pdfTotal: pdfTotal,
      excelTotal: excelTotal,
      comparisons: comparisons,
      itemsMatch: comparisons.every(c => c.isMatch)
    });

  } catch (err: any) {
    console.error('검합 수행 중 오류:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
