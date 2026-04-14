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

/**
 * 정밀 매칭 스코어링 (품질 가중치 적용)
 */
function getMatchScore(style: string, dbRow: any, barcodeCols: string[]): number {
    const s = normalizeStr(style);
    if (!s) return 0;

    let maxScore = 0;
    for (const key of barcodeCols) {
        const val = normalizeStr(dbRow[key]);
        if (!val) continue;

        let currentScore = 0;
        if (val === s) currentScore = 150; // 기본점수 상향
        else if (val.startsWith(s)) currentScore = 90;
        else if (val.includes(s)) currentScore = 70;
        else {
            let matches = 0;
            const minLen = Math.min(s.length, val.length);
            for(let i=0; i<minLen; i++) if(s[i] === val[i]) matches++;
            const ratio = matches / Math.max(s.length, val.length);
            if (ratio >= 0.8) currentScore = (ratio * 80);
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
        const result = await client.query('SELECT * FROM products');
        dbRows = result.rows;
    } finally {
        client.release();
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        let bestMatch: any = null, bestScore = -1;

        for (let row of dbRows) {
            const baseScore = getMatchScore(ex.styleNo, row, barcodeCols);
            if (baseScore <= 0) continue;

            // --- 품질 가산점 시스템 ---
            let qualityBonus = 0;
            const dbName = (row["상품명"] || row["name"] || "").toString();
            const dbCode = (row["상품코드"] || row["code"] || "").toString();
            const dbOpt = (row["옵션"] || "").toString().toUpperCase();
            const exColor = ex.color.toUpperCase().trim();

            // 1. 진짜 이름 보너스 (압도적 가산점)
            if (dbName && dbName !== dbCode && dbName.length > 3) {
                qualityBonus += 100;
            }

            // 2. 색상 일치 보너스
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (exColor.includes(group) || synonyms.some(s => exColor.includes(s))) {
                    if ([group, ...synonyms].some(t => dbOpt.includes(t))) {
                        qualityBonus += 50; 
                        break;
                    }
                }
            }

            const totalScore = baseScore + qualityBonus;
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = row;
            }
        }

        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestMatch && bestScore >= 60) {
            let korColor = ex.color;
            const optVal = (bestMatch["옵션"] || "").toString();
            const optParts = optVal.split(',').map((p:string) => p.replace(/[:\s]/g, '').trim());
            const exColor = ex.color.toUpperCase().trim();
            
            let foundGroup = "";
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (exColor.includes(group) || synonyms.some(s => exColor.includes(s))) { foundGroup = group; break; }
            }
            if (foundGroup) {
                const targets = [foundGroup, ...COLOR_MAP[foundGroup]];
                for (let p of optParts) {
                    if (targets.some(t => p.toUpperCase() === t.toUpperCase() || p.includes(t))) {
                        korColor = p; break;
                    }
                }
            }

            // 최종 이름 결정: DB 이름이 부실하면 PDF 원본 이름을 사용
            let finalName = bestMatch["상품명"] || bestMatch["name"] || '상품명누락';
            if (finalName === bestMatch["상품코드"] || finalName.length < 2) {
                finalName = ex.pdfName;
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

// Elite Quality Fix: 1776137975219