import { NextRequest, NextResponse } from 'next/server';
import { getChinaPackingResults } from '@/lib/china-parser';
import { matchExcelBuffer } from '@/lib/matcher';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. 중국 패킹 분석 (파일명과 함께 전달하여 XLS/PDF 정밀 판단)
    const rawResults = await getChinaPackingResults(buffer, file.name);
    if (rawResults.length === 0) throw new Error("분석할 데이터를 찾지 못했습니다.");

    const originalTotal = rawResults.reduce((acc, cur) => acc + cur.qty, 0);

    // 2. 임시 엑셀 생성
    const tempWb = new ExcelJS.Workbook();
    const tempWs = tempWb.addWorksheet('Temp');
    tempWs.addRow(['STYLE NO', 'NAME', 'COLOR', 'SIZE', 'QTY']);
    rawResults.forEach(r => tempWs.addRow([r.style, r.name, r.color, r.size, r.qty]));
    const tempBuffer = await tempWb.xlsx.writeBuffer();

    // 3. 마스터 매칭
    const matchedWb = await matchExcelBuffer(Buffer.from(tempBuffer));
    const matchedWs = matchedWb.worksheets[0];

    // 4. 추출된 데이터 구성
    const finalItems: any[] = [];
    let matchedTotal = 0;
    
    matchedWs.eachRow((row, i) => {
        if (i === 1) return;
        const q = parseInt(row.getCell(5).text) || 0;
        matchedTotal += q;
        finalItems.push({
            matchedCode: row.getCell(1).text,
            matchedName: row.getCell(2).text,
            color: row.getCell(3).text,
            size: row.getCell(4).text,
            qty: q,
            pdfQty: q
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
    console.error('CHINA_CONVERT_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '중국 패킹 처리 중 알 수 없는 오류' }, { status: 200 }); // 클라이언트에서 에러 메시지를 보기 위해 200으로 반환하되 success: false
  }
}
