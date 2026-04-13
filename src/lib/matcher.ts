import ExcelJS from 'exceljs';
import pg from 'pg';
const { Pool } = pg;

// 슈파베이스 연결 설정
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

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
    return s.toString().replace(/[^0-9A-Z]/gi, '').toUpperCase().replace(/0/g, 'O');
}

// 유사도 측정 함수 (80% 일치 확인용)
function getSimilarity(s1: string, s2: string) {
    if (!s1 || !s2) return 0;
    const n1 = normalizeStr(s1);
    const n2 = normalizeStr(s2);
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.9;
    
    // 단순 글자 포함 비율로 유사도 측정
    let matchingChars = 0;
    const minLen = Math.min(n1.length, n2.length);
    for (let i = 0; i < minLen; i++) {
        if (n1[i] === n2[i]) matchingChars++;
    }
    return matchingChars / Math.max(n1.length, n2.length);
}

export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    
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

    const client = await pool.connect();
    let dbRecords: any[] = [];
    try {
        // '상품바코드' 컬럼 추가 쿼리
        const result = await client.query('SELECT "상품코드", "상품명", "옵션", "상품바코드" FROM products');
        dbRecords = result.rows.map(r => ({
            productCode: r.상품코드 || '',
            productName: r.상품명 || '',
            option: r.옵션 || '',
            barcode: r.상품바코드 || '',
            normBarcode: normalizeStr(r.상품바코드)
        }));
    } catch (err) {
        console.error('DB 쿼리 중 오류:', err);
    } finally {
        client.release();
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        const exNormStyle = normalizeStr(ex.styleNo);
        let bestMatch: any = null, bestScore = -1;

        // 바코드 기반 매칭 (80% 유사도 룰 적용)
        for (let m of dbRecords) {
            let score = 0;
            const sim = getSimilarity(ex.styleNo, m.barcode);
            
            if (sim >= 0.8) {
                score += (sim * 80); // 바코드 유사도 80% 이상 시 높은 가중치
            } else {
                continue; // 바코드가 안 맞으면 일단 패스 (오매칭 방지)
            }

            // 색상 및 옵션 점수 가산
            const opt = m.option.replace(/\s+/g, '').toUpperCase();
            const exColor = ex.color.toUpperCase().trim();
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
              if (group === exColor || synonyms.includes(exColor)) {
                const targets = [group, ...synonyms];
                if (targets.some(t => opt.includes(t.replace(/\s+/g, '').toUpperCase()))) {
                  score += 20;
                  break;
                }
              }
            }

            if (score > bestScore) { bestScore = score; bestMatch = m; }
        }

        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        if (bestMatch && bestScore >= 60) {
            let korColor = ex.color;
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
