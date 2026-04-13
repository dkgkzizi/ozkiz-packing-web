import ExcelJS from 'exceljs';
import pg from 'pg';
const { Pool } = pg;

// 슈파베이스 연결 설정 (DATABASE_URL 우선 사용)
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// 색상 매핑 사전 업데이트
const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍', '핫핑크', '연핑크'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이', 'G MEL', 'MEL', 'GMEL'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'GREY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지', '오트밀'],
    'BLUE': ['블루', '파랑', '민트', '소라'],
    'NAVY': ['네이비', '남색'],
    'RED': ['레드', '빨강', '와인'],
    'GREEN': ['그린', '초록'],
    'PURPLE': ['퍼플', '보라', '라벤더'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색', '코코아'],
    'LIME': ['라임', '연두'],
    'ORANGE': ['오렌지', '주황']
};

function normalizeStr(s: any) {
    if (!s) return "";
    // 특수문자 제거 및 0/O 혼동 방지 (비교용 정규화)
    return s.toString().replace(/[^0-9A-Z]/gi, '').toUpperCase().replace(/0/g, 'O');
}

export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    
    // 1. 엑셀 데이터 추출
    const excelRecords: any[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const styleNo = row.getCell(1).text.trim();
        if (!styleNo || styleNo.includes('합계') || styleNo === 'STYLE NO' || styleNo.includes('TOTAL')) return;
        
        excelRecords.push({
            styleNo: styleNo,
            pdfName: row.getCell(2).text.trim(),
            color: row.getCell(3).text.trim(),
            size: row.getCell(4).text.trim(),
            qty: parseInt(row.getCell(5).value as any) || 0
        });
    });

    // 2. 슈파베이스 DB 데이터 조회
    const client = await pool.connect();
    let dbRecords: any[] = [];
    try {
        const result = await client.query('SELECT "상품코드", "상품명", "옵션" FROM products');
        dbRecords = result.rows.map(r => ({
            productCode: r.상품코드 || '',
            productName: r.상품명 || '',
            option: r.옵션 || '',
            normStyle: normalizeStr(r.상품코드)
        }));
    } catch (err) {
        console.error('DB 쿼리 중 오류:', err);
    } finally {
        client.release();
    }

    // 3. 지능형 매칭 수행
    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        const exNormStyle = normalizeStr(ex.styleNo);
        // 스타일 번호가 완벽히 일치하거나 포함되는 것들 1차 필터링
        let matches = dbRecords.filter(s => s.normStyle === exNormStyle || s.normStyle.includes(exNormStyle) || exNormStyle.includes(s.normStyle));
        
        // 스타일로 안 잡히면 상품명으로 2차 필터링
        if (matches.length === 0) {
            matches = dbRecords.filter(s => s.productName.includes(ex.styleNo) || s.productName.includes(ex.pdfName));
        }

        let bestMatch: any = null, bestScore = -1;
        if (matches.length > 0) {
            const exColor = ex.color.toUpperCase().trim();
            for(let m of matches) {
                let score = 0;
                const opt = m.option.replace(/\s+/g, '').toUpperCase();
                
                // 가중치 부여
                if (m.normStyle === exNormStyle) score += 50; // 스타일번호 일치 시 높은 점수
                if (ex.size && opt.includes(ex.size.replace(/\s+/g, '').toUpperCase())) score += 15;
                
                // 색상 매핑 점수
                for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                  if (group === exColor || synonyms.includes(exColor)) {
                    const targets = [group, ...synonyms];
                    if (targets.some(t => opt.includes(t.replace(/\s+/g, '').toUpperCase()))) {
                      score += 25; // 색상 매칭 시 가중 점수
                      break;
                    }
                  }
                }
                
                if (score > bestScore) { bestScore = score; bestMatch = m; }
            }
        }
        
        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        if (bestMatch && bestScore >= 40) { // 최소 매칭 임계점
            let korColor = ex.color; // 폴백: 영문
            
            // DB 옵션에서 가장 적절한 한국어 색상 명칭 찾기
            const optParts = bestMatch.option.split(',').map((p:string) => p.replace(/[:\s]/g, '').trim());
            const exColor = ex.color.toUpperCase().trim();
            
            let foundGroupName = "";
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
              if (group === exColor || synonyms.includes(exColor)) {
                foundGroupName = group; break;
              }
            }

            if (foundGroupName) {
              const targets = [foundGroupName, ...COLOR_MAP[foundGroupName]];
              for (let p of optParts) {
                if (targets.some(t => p.toUpperCase() === t.toUpperCase() || p.includes(t))) {
                  korColor = p; break;
                }
              }
            }

            matchedRaw.push({
                productCode: bestMatch.productCode,
                sheetName: bestMatch.productName,
                color: korColor, size: ex.size, qty: ex.qty,
                originalKey: originalKey
            });
        } else {
            matchedRaw.push({
                productCode: '미매칭',
                sheetName: ex.pdfName,
                color: ex.color, size: ex.size, qty: ex.qty,
                originalKey: originalKey
            });
        }
    });

    // 4. 합계 및 정렬 후 엑셀 출력
    const aggregated: Record<string, any> = {};
    matchedRaw.forEach(item => {
        const key = `${item.productCode}|${item.sheetName}|${item.color}|${item.size}`;
        if (aggregated[key]) {
            aggregated[key].qty += item.qty;
            aggregated[key].originalKeys.push(item.originalKey);
        } else {
            aggregated[key] = { ...item, originalKeys: [item.originalKey] };
        }
    });

    const finalResults = Object.values(aggregated).sort((a:any, b:any) => {
        if (a.productCode === '미매칭' && b.productCode !== '미매칭') return 1;
        if (a.productCode !== '미매칭' && b.productCode === '미매칭') return -1;
        return a.sheetName.localeCompare(b.sheetName);
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('매칭결과');
    const today = new Date();
    const memoDate = today.toISOString().slice(2, 10).replace(/-/g, '');
    const memoContent = `${memoDate}_인도 입고`;

    outWs.columns = [
        { header: '상품코드', key: 'productCode', width: 20 },
        { header: '상품명', key: 'sheetName', width: 40 },
        { header: '색상', key: 'color', width: 15 },
        { header: '사이즈', key: 'size', width: 12 },
        { header: '작업수량', key: 'qty', width: 15 },
        { header: '메모', key: 'memo', width: 25 },
        { header: '식별키', key: 'originalKey', width: 35, hidden: true }
    ];

    const hRow = outWs.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    
    finalResults.forEach(r => {
        const row = outWs.addRow({
            productCode: r.productCode,
            sheetName: r.sheetName,
            color: r.color,
            size: r.size,
            qty: r.qty,
            memo: memoContent,
            originalKey: r.originalKeys.join(';')
        });
        if (r.productCode === '미매칭') {
            row.eachCell(c => { c.font = { color: { argb: 'FFFF0000' } }; });
        }
    });

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    return outWb;
}
