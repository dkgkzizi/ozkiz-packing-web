import ExcelJS from 'exceljs';
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리', '흰색'],
    'BLACK': ['블랙', '검정', '검정색'],
    'PINK': ['핑크', '분홍', '핫핑크', '연핑크'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이', 'G MEL', 'MEL', 'GMEL'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'GREY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지', '오트밀'],
    'BLUE': ['블루', '파랑', '민트', '소라', 'S BLUE', 'SKY BLUE'],
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
    return s.toString().replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function getMatchScore(style: string, dbRow: any, barcodeCols: string[]): number {
    const s = normalizeStr(style);
    if (!s) return 0;

    let maxScore = 0;
    for (const key of barcodeCols) {
        const val = normalizeStr(dbRow[key]);
        if (!val) continue;

        let currentScore = 0;
        if (val === s) currentScore = 150;
        else if (val.startsWith(s)) currentScore = 90;
        else if (val.includes(s)) currentScore = 70;
        else {
            let matches = 0;
            const minLen = Math.min(s.length, val.length);
            for(let i=0; i<minLen; i++) if(s[i] === val[i]) matches++;
            const ratio = matches / Math.max(s.length, val.length);
            if (ratio >= 0.8) currentScore = (ratio * 85);
        }
        if (currentScore > maxScore) maxScore = currentScore;
    }
    return maxScore;
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
    let dbRows: any[] = [];
    let barcodeCols: string[] = [];
    try {
        const tableInfo = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        const allCols = tableInfo.rows.map(r => r.column_name);
        barcodeCols = allCols.filter(c => ['바코드', 'barcode', 'style', 'code', '코드', '관리번호'].some(k => c.toLowerCase().includes(k)));
        if (barcodeCols.length === 0) barcodeCols = ['상품코드', '상품명', '옵션'].filter(c => allCols.includes(c));
        const result = await client.query('SELECT * FROM products ORDER BY id DESC'); // 최신순 정렬
        dbRows = result.rows;
    } finally {
        client.release();
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        let candidates: any[] = [];
        const normalizedExColor = ex.color.toUpperCase().trim();

        // 1단계: 모든 후보군 추출 및 점수 산정
        for (let row of dbRows) {
            const baseScore = getMatchScore(ex.styleNo, row, barcodeCols);
            if (baseScore <= 0) continue;

            let colorScore = 0;
            const dbOpt = (row["옵션"] || "").toString().toUpperCase();
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (normalizedExColor.includes(group) || synonyms.some(s => normalizedExColor.includes(s))) {
                    if ([group, ...synonyms].some(t => dbOpt.includes(t))) {
                        colorScore = 50; break;
                    }
                }
            }

            const dbName = (row["상품명"] || row["name"] || "").toString();
            const dbCode = (row["상품코드"] || row["code"] || "").toString();
            // 진짜 한국어 이름이 있는 행에 엄청난 가산점 부여 (품질 우선순위)
            let qualityScore = (dbName && dbName !== dbCode && dbName.length > 2) ? 200 : 0;

            candidates.push({ row, score: baseScore + colorScore + qualityScore, nameScore: qualityScore });
        }

        // 2단계: 최적의 후보 선정 (점수 최고점 중에서도 품질 점수가 높은 것 우선)
        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates[0];

        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestCandidate && bestCandidate.score >= 50) {
            const bestMatch = bestCandidate.row;
            let korColor = ex.color;
            const optVal = (bestMatch["옵션"] || "").toString();
            const optParts = optVal.split(',').map((p:string) => p.replace(/[:\s]/g, '').trim());
            
            let foundGroup = "";
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (normalizedExColor.includes(group) || synonyms.some(s => normalizedExColor.includes(s))) { foundGroup = group; break; }
            }
            if (foundGroup) {
                const targets = [foundGroup, ...COLOR_MAP[foundGroup]];
                for (let p of optParts) {
                    if (targets.some(t => p.toUpperCase() === t.toUpperCase() || p.includes(t))) {
                        korColor = p; break;
                    }
                }
            }

            // 품질 점수가 0인 경우(이름이 코드와 같은 경우), 다른 후보들 중에서 진짜 이름이 있는지 한 번 더 수색
            let finalName = bestMatch["상품명"] || bestMatch["name"] || '상품명누락';
            if (bestCandidate.nameScore === 0) {
                const legacyMatch = candidates.find(c => c.nameScore > 0);
                if (legacyMatch) finalName = legacyMatch.row["상품명"] || legacyMatch.row["name"];
            }

            // 그래도 여전히 이름이 부실하면 PDF 이름을 사용하거나 DB 이름을 유지
            if (finalName === bestMatch["상품코드"] || finalName.length < 2) {
                // PDF 이름 조차 부실할 때만 DB 이름을 최후의 수단으로 사용
                finalName = (ex.pdfName && ex.pdfName.length > 2) ? ex.pdfName : finalName;
            }

            matchedRaw.push({
                productCode: bestMatch["상품코드"] || bestMatch["code"] || '코드누락',
                sheetName: finalName,
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
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
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
// Recovery Logic Fix: 1776138209460