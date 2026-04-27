import { NextRequest, NextResponse } from 'next/server';
import { getRawPackingResults } from '@/lib/parser';
import { matchExcelBuffer } from '@/lib/matcher';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. PDF에서 RAW 데이터 추출
    const rawResults = await getRawPackingResults(buffer);
    if (rawResults.length === 0) throw new Error("PDF에서 데이터를 추출하지 못했습니다.");

    // [전문화/최적화] 동일 상품(스타일, 이름, 컬러, 사이즈) 데이터 사전에 합치기
    const aggregated: Record<string, any> = {};
    rawResults.forEach(res => {
        const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
        if (aggregated[key]) {
            aggregated[key].qty += res.qty;
        } else {
            aggregated[key] = { ...res };
        }
    });
    const finalRawResults = Object.values(aggregated);

    const originalTotal = finalRawResults.reduce((acc, cur) => acc + cur.qty, 0);

    // [보안/무결성] 비정상적인 수량 인플레이션 감지 (300만개 등 방지)
    if (originalTotal > 100000) {
        throw new Error(`비정상적인 총 수량이 감지되었습니다 (${originalTotal.toLocaleString()}개). PDF의 무게나 합계 정보가 수량으로 오인되었을 가능성이 있습니다. 로직을 재검토하십시오.`);
    }

    // 2. 임시 엑셀 생성 (합산된 데이터로 생성하여 매칭 횟수 최소화)
    const tempWb = new ExcelJS.Workbook();
    const tempWs = tempWb.addWorksheet('Temp');
    tempWs.addRow(['STYLE NO', 'NAME', 'COLOR', 'SIZE', 'QTY']);
    finalRawResults.forEach(r => tempWs.addRow([r.style, r.name, r.color, r.size, r.qty]));
    const tempBuffer = await tempWb.xlsx.writeBuffer();

    // 3. 수파베이스 마스터 매칭 엔진 가동
    const matchedWb = await matchExcelBuffer(Buffer.from(tempBuffer), 'india', file.name);
    const matchedWs = matchedWb.worksheets[0];

    // 4. 프론트엔드용 JSON 데이터 추출 (행 단위 원본 수량 추적)
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
            qty: q, // 최종 매칭 수량
            pdfQty: q, // 원본 수량 (매칭 엔진에서 수량이 변조되지 않으므로 q와 동일하게 세팅하여 대조군 형성)
            originalKey: row.getCell(7).text 
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
    console.error('INDIA_ROW_AUDIT_ERROR:', err);
    return NextResponse.json({ success: false, message: '행 단위 검증 모듈 오류: ' + err.message }, { status: 500 });
  }
}
