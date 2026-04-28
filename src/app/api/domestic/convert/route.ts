import { NextRequest, NextResponse } from 'next/server';
import { getDomesticPackingResults } from '@/lib/domestic-parser';
import { matchExcelBuffer } from '@/lib/domestic-matcher';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. 국내 패킹 이미지/PDF 분석 (Gemini AI 활용)
    const rawResults = await getDomesticPackingResults(buffer, file.name);
    if (rawResults.length === 0) throw new Error("분석할 데이터를 찾지 못했습니다.");

    const originalTotal = rawResults.reduce((acc, cur) => acc + cur.qty, 0);

    // 2. 임시 엑셀 생성
    const tempWb = new ExcelJS.Workbook();
    const tempWs = tempWb.addWorksheet('Temp');
    tempWs.addRow(['STYLE NO', 'NAME', 'COLOR', 'SIZE', 'QTY']);
    rawResults.forEach(r => tempWs.addRow([r.style, r.name, r.color, r.size, r.qty]));
    const tempBuffer = await tempWb.xlsx.writeBuffer();

    // 3. 마스터 매칭 (Supabase 연동)
    const matchedWb = await matchExcelBuffer(Buffer.from(tempBuffer), 'domestic', file.name);
    const matchedWs = matchedWb.worksheets[0];

    // 4. 프론트엔드용 JSON 및 검증 데이터 추출
    const finalItems: any[] = [];
    let matchedTotal = 0;
    
    matchedWs.eachRow((row, i) => {
        if (i === 1) return;
        const q = parseInt(row.getCell(5).text) || 0;
        matchedTotal += q;
        const originalKey = row.getCell(7).text || "";
        const styleName = originalKey.split('|')[0] || row.getCell(2).text;

        finalItems.push({
            matchedCode: row.getCell(1).text,
            matchedName: row.getCell(2).text,
            color: row.getCell(3).text,
            size: row.getCell(4).text,
            qty: q,
            pdfQty: q,
            style: styleName
        });
    });

    return NextResponse.json({ 
        success: true, 
        items: finalItems,
        originalTotal,
        matchedTotal,
        fileName: file.name
    });

  } catch (err: any) {
    console.error('DOMESTIC_AUDIT_ERROR:', err);
    return NextResponse.json({ success: false, message: '국내 검증 모듈 오류: ' + err.message }, { status: 500 });
  }
}
