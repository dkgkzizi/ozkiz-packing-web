import { NextRequest, NextResponse } from 'next/server';
import { matchExcelBuffer } from '@/lib/matcher';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
    const { items: rawResults, fileName } = await req.json();
    
    if (!rawResults || rawResults.length === 0) {
        return NextResponse.json({ success: false, message: '데이터 없음' }, { status: 400 });
    }

    const originalTotal = rawResults.reduce((acc: number, cur: any) => acc + (cur.qty || 0), 0);

    // 2. 임시 엑셀 생성 (매칭 엔진 입력용)
    const tempWb = new ExcelJS.Workbook();
    const tempWs = tempWb.addWorksheet('Temp');
    tempWs.addRow(['STYLE NO', 'NAME', 'COLOR', 'SIZE', 'QTY']);
    rawResults.forEach(r => tempWs.addRow([r.style, r.name, r.color, r.size, r.qty]));
    const tempBuffer = await tempWb.xlsx.writeBuffer();

    // 3. 마스터 매칭 (Supabase 연동)
    const matchedWb = await matchExcelBuffer(Buffer.from(tempBuffer), 'china');
    const matchedWs = matchedWb.worksheets[0];

    // 4. 최종 데이터 구성 (이미지 URL 포함)
    const finalItems: any[] = [];
    let matchedTotal = 0;
    
    matchedWs.eachRow((row, i) => {
        if (i === 1) return;
        const q = parseInt(row.getCell(5).text) || 0;
        matchedTotal += q;
        
        // 매칭된 원본 데이터(Supabase)에서 이미지 URL 추출 시도
        // matcher.ts가 저장한 데이터를 기반으로 구성
        const originalKey = row.getCell(7).text || "";
        const styleName = originalKey.split('|')[0] || row.getCell(2).text;

        finalItems.push({
            matchedCode: row.getCell(1).text,
            matchedName: row.getCell(2).text,
            color: row.getCell(3).text,
            size: row.getCell(4).text,
            qty: q,
            pdfQty: q,
            style: styleName,
            imageUrl: null 
        });
    });

    return NextResponse.json({ 
        success: true, 
        items: finalItems,
        originalTotal,
        matchedTotal,
        fileName: fileName
    });

  } catch (err: any) {
    console.error('CHINA_OZ_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '중국 패킹 처리 중 오류' }, { status: 200 });
  }
}
