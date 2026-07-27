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

    const rawTotal = finalRawResults.reduce((acc: number, cur: any) => acc + cur.qty, 0);

    // [보안/무결성] 비정상적인 수량 인플레이션 감지 (300만개 등 방지)
    if (rawTotal > 100000) {
        throw new Error(`비정상적인 총 수량이 감지되었습니다 (${rawTotal.toLocaleString()}개). PDF의 무게나 합계 정보가 수량으로 오인되었을 가능성이 있습니다. 로직을 재검토하십시오.`);
    }

    // 2. 임시 엑셀 생성 (합산된 데이터로 생성하여 매칭 횟수 최소화)
    const tempWb = new ExcelJS.Workbook();
    const tempWs = tempWb.addWorksheet('Temp');
    tempWs.addRow(['STYLE NO', 'NAME', 'COLOR', 'SIZE', 'QTY']);
    finalRawResults.forEach((r: any) => tempWs.addRow([r.style, r.name, r.color, r.size, r.qty]));
    const tempBuffer = await tempWb.xlsx.writeBuffer();

    // 3. 수파베이스 마스터 매칭 엔진 가동 (여기서 "세트" 상품의 수량 절반 보정도 함께 처리된다 -
    // PDF 원본 텍스트에는 카테고리가 한글로 안 적혀있어서 매칭 이전엔 "세트"인지 알 수 없고,
    // DB에 확정 매칭된 상품명으로만 판단 가능하기 때문)
    const matchedWb = await matchExcelBuffer(Buffer.from(tempBuffer), 'india', file.name);
    const matchedWs = matchedWb.worksheets[0];

    // 4. 프론트엔드용 JSON 데이터 추출 (행 단위 원본 수량 추적)
    // "세트" 상품의 수량은 matcher.ts에서 이미 절반으로 보정되어 나온다. originalTotal도
    // 이 보정된 수량 기준으로 계산해야 "원본수량/매칭수량" 배너가 항상 일치하는 채로 정상
    // 표시된다 — 보정 전 수량(예: 3718)과 보정 후 매칭 수량(예: 1859)을 그대로 비교하면
    // 의도된 보정임에도 "불일치"로 잘못 표시되기 때문이다.
    const finalItems: any[] = [];
    let matchedTotal = 0;
    let originalTotal = 0;

    matchedWs.eachRow((row, i) => {
        if (i === 1) return;
        const q = parseInt(row.getCell(5).text) || 0;
        matchedTotal += q;
        originalTotal += q;

        // "세트" 상품은 화면의 QTY FLOW 표시(취소선 숫자 -> 최종 숫자)에서 실제로 반으로
        // 줄었다는 걸 보여주기 위해 pdfQty는 보정 전(2배) 수량을 다시 보여준다.
        const matchedName = row.getCell(2).text;
        const isSetProduct = (matchedName || '').includes('세트');
        const pdfQty = isSetProduct ? q * 2 : q;

        finalItems.push({
            matchedCode: row.getCell(1).text,
            matchedName: row.getCell(2).text,
            color: row.getCell(3).text,
            size: row.getCell(4).text,
            qty: q,
            pdfQty,
            boxNo: row.getCell(9).text,
            boxCount: parseInt(row.getCell(10).text) || 1,
            originalKey: row.getCell(8).text,
            verified: row.getCell(11).text === 'Y'
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
