import ExcelJS from 'exceljs';
import pool from '@/lib/db';

function normalizeStr(s: any) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z가-힣]/gi, '').toUpperCase();
}

export async function matchExcelBuffer(buffer: Buffer, type: string = 'india', fileName: string = ""): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const excelRecords: any[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const styleNo = row.getCell(1).text.trim();
        if (!styleNo || styleNo.includes('합계')) return;
        excelRecords.push({
            styleNo: styleNo,
            pdfName: row.getCell(2).text.trim(),
            color: row.getCell(3).text.trim(),
            size: row.getCell(4).text.trim(),
            qty: parseInt(row.getCell(5).value as any) || 0,
            sheetName: row.getCell(6).text.trim() || fileName
        });
    });

    const client = await pool.connect();
    let dbRows: any[] = [];
    try {
        const uniqueStyles = Array.from(new Set(excelRecords.map(r => r.styleNo).filter(s => s && s.length >= 2)));
        if (uniqueStyles.length > 0) {
            const patterns = uniqueStyles.map(s => `%${normalizeStr(s)}%`);
            const res = await client.query(`
                SELECT "상품명", "상품코드", "바코드", "옵션" FROM products 
                WHERE REGEXP_REPLACE("바코드", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1) 
                   OR REGEXP_REPLACE("상품코드", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1)
                   OR REGEXP_REPLACE("상품명", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1)
            `, [patterns]);
            dbRows = res.rows;
        }
    } finally {
        client.release();
    }

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지'],
    'BLUE': ['블루', '파랑'],
    'NAVY': ['네이비', '남색'],
    'RED': ['레드', '빨강'],
    'GREEN': ['그린', '초록'],
    'MINT': ['민트'],
    'PURPLE': ['퍼플', '보라'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색']
};

    const finalResults = excelRecords.map(record => {
        const nStyle = normalizeStr(record.styleNo);
        let bestMatch = null;
        let bestScore = -1;

        dbRows.forEach(row => {
            let score = 0;
            const dbName = normalizeStr(row['상품명']);
            const dbCode = normalizeStr(row['상품코드']);
            const dbBarcode = normalizeStr(row['바코드']);
            const dbOption = normalizeStr(row['옵션'] || '');

            // 1. 기본 매칭 (스타일/상품명 일치)
            if (dbName.includes(nStyle) || dbCode.includes(nStyle) || dbBarcode.includes(nStyle) || dbOption.includes(nStyle)) {
                score += 10;
            } else {
                return; // 기본 조건 불만족 시 스킵
            }

            // 2. 사이즈 매칭
            if (record.size) {
                const nSize = normalizeStr(record.size);
                if (nSize && (dbBarcode.includes(nSize) || dbOption.includes(nSize))) {
                    score += 20;
                }
            }

            // 3. 색상 매칭
            if (record.color) {
                const nColor = normalizeStr(record.color);
                const upperColor = record.color.trim().toUpperCase();
                let matchedColor = false;
                
                if (nColor && (dbBarcode.includes(nColor) || dbOption.includes(nColor))) {
                    score += 15;
                    matchedColor = true;
                }
                
                if (!matchedColor && COLOR_MAP[upperColor]) {
                    for (let syn of COLOR_MAP[upperColor]) {
                        if (dbBarcode.includes(normalizeStr(syn)) || dbOption.includes(normalizeStr(syn))) {
                            score += 15;
                            matchedColor = true;
                            break;
                        }
                    }
                }
                
                if (!matchedColor) {
                    for (let engColor in COLOR_MAP) {
                        if (COLOR_MAP[engColor].some(kc => kc === record.color.trim())) {
                            if (dbBarcode.includes(normalizeStr(engColor)) || dbOption.includes(normalizeStr(engColor))) {
                                score += 15;
                                matchedColor = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = row;
            }
        });

        // 완벽한 매칭(상품명+색상+사이즈)이 아니면(점수가 너무 낮으면) 실패 처리 방어
        // 보통 색상이나 사이즈 중 하나라도 일치하면 25점 이상이 됨.
        const isValidMatch = bestMatch && bestScore >= 25;

        return {
            productCode: isValidMatch ? bestMatch['상품코드'] : '미매칭',
            sheetName: isValidMatch ? bestMatch['상품명'] : record.pdfName,
            color: record.color, 
            size: record.size,   
            qty: record.qty,
            originalStyle: record.styleNo
        };
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('매칭결과');
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    outWs.columns = [
        { header: '상품코드', key: 'productCode', width: 20 },
        { header: '상품명', key: 'sheetName', width: 40 },
        { header: '색상', key: 'color', width: 15 },
        { header: '사이즈', key: 'size', width: 12 },
        { header: '작업수량', key: 'qty', width: 15 },
        { header: '메모', key: 'memo', width: 25 },
        { header: '시트명', key: 'originSheet', width: 20 }
    ];

    const hRow = outWs.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } };

    finalResults.forEach(r => {
        outWs.addRow({
            productCode: r.productCode,
            sheetName: r.sheetName,
            color: r.color,
            size: r.size,
            qty: r.qty,
            memo: `${memoDate}_인도 입고`,
            originSheet: r.originSheet
        });
    });

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    return outWb;
}
