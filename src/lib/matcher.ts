import ExcelJS from 'exceljs';
import pool from '@/lib/db';

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리', '백색'],
    'BLACK': ['블랙', '검정', '검정색'],
    'PINK': ['핑크', '분홍', '핫핑크', '인디핑크'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이', 'G MEL', 'MEL', 'GMEL'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'GREY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지', '오트밀'],
    'BLUE': ['블루', '파랑', '민트', '소라', 'S BLUE', 'SKY BLUE'],
    'NAVY': ['네이비', '곤색'],
    'RED': ['레드', '빨강', '다홍'],
    'GREEN': ['그린', '초록'],
    'PURPLE': ['퍼플', '보라', '라벤더'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색', '코코아'],
    'LIME': ['라임', '연두'],
    'ORANGE': ['오렌지', '주황'],
    'KHAKI': ['카키'],
    'WINE': ['와인'],
    'GOLD': ['골드', '금색'],
    'SILVER': ['실버', '은색'],
    'MINT': ['민트'],
    'LAVENDER': ['라벤더'],
    'COCOA': ['코코아']
};

function decomposeHangul(str: string): string {
    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    let result = "";
    for (const char of str) {
        const code = char.charCodeAt(0) - 44032;
        if (code > -1 && code < 11172) {
            const cho = Math.floor(code / 588);
            const jung = Math.floor((code - (cho * 588)) / 28);
            const jong = code % 28;
            result += CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
        } else { result += char; }
    }
    return result;
}

function normalizeStr(s: any) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z가-힣]/gi, ' ').replace(/\s+/g, '').toUpperCase();
}

function getLevenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

function getSimilarity(s1: string, s2: string): number {
    const s1_clean = s1.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
    const s2_clean = s2.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
    if (s1 === s2 || s1_clean === s2_clean) return 1.0;
    if (s1_clean && s2_clean && (s1_clean.length >= 3 || s2_clean.length >= 3)) {
        if (s1_clean.includes(s2_clean) || s2_clean.includes(s1_clean)) return 0.95;
    }
    const tokens1 = s1.split(/[^0-9A-Z가-힣]/).filter(t => t.length >= 2);
    const tokens2 = s2.split(/[^0-9A-Z가-힣]/).filter(t => t.length >= 2);
    for (const t1 of tokens1) {
        if (tokens2.includes(t1)) return 0.9;
    }
    const distance = getLevenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    return 1 - distance / maxLen;
}

function getMatchScore(style: string, dbRow: any, barcodeCols: string[]): number {
    const s = normalizeStr(style);
    if (!s) return 0;
    let maxScore = 0;
    const threshold = 0.7; 
    for (const key of barcodeCols) {
        const val = normalizeStr(dbRow[key]);
        if (!val) continue;
        const score = getSimilarity(s, val);
        if (score > maxScore) maxScore = score;
    }
    return maxScore >= threshold ? maxScore : 0;
}

// 기존 로직 보존 (국내/중국용)
export function getColorScore(styleColor: string, dbColor: string): number {
    const sc = styleColor.toUpperCase();
    const dc = dbColor.toUpperCase();
    if (sc === dc) return 100;
    if (sc.includes(dc) || dc.includes(sc)) return 80;
    for (const [key, aliases] of Object.entries(COLOR_MAP)) {
        if (sc.includes(key) || aliases.some(a => sc.includes(a))) {
            if (dc.includes(key) || aliases.some(a => dc.includes(a))) return 70;
        }
    }
    return 0;
}

// 인도용 신규 컬러 매칭 로직
function getColorScoreIndia(styleColor: string, dbOption: string, dbName: string): number {
    const sc = styleColor.toUpperCase().trim();
    const target = (dbOption + dbName).toUpperCase();
    if (!sc) return 0;
    if (target.includes(sc)) return 100;
    for (const [key, aliases] of Object.entries(COLOR_MAP)) {
        if (sc === key || aliases.includes(sc)) {
            if (target.includes(key) || aliases.some(a => target.includes(a))) return 80;
        }
    }
    return 0;
}

// 인도용 신규 사이즈 매칭 로직
function getSizeScoreIndia(recordSize: string, dbOption: string): number {
    const rs = recordSize.toUpperCase().trim();
    const dos = dbOption.toUpperCase().trim();
    if (!rs || !dos) return 0;
    const isNumeric = /^\d+$/.test(rs);
    if (isNumeric) {
        const regex = new RegExp(`(?<!\\d)${rs}(?!\\d)`);
        if (regex.test(dos)) return 100;
    } else {
        const regex = new RegExp(`(?<![A-Z])${rs}(?![A-Z])`);
        if (regex.test(dos)) return 100;
        if (rs === 'F' && (dos.includes('FREE') || dos.includes(' F '))) return 100;
        if (rs === 'FREE' && (dos.includes(' F ') || dos.endsWith(' F'))) return 100;
    }
    const rsNum = rs.replace(/[^0-9]/g, '');
    if (rsNum && rsNum.length >= 2) {
        const regex = new RegExp(`(?<!\\d)${rsNum}(?!\\d)`);
        if (regex.test(dos)) return 60;
    }
    return 0;
}

export function getSeasonScore(name: string): number {
    const month = new Date().getMonth() + 1;
    const n = name.toUpperCase();
    let score = 0;
    const isSS = month >= 2 && month <= 7;
    const isFW = month >= 8 || month <= 1;
    if (isSS && (n.includes('SS') || n.includes('S/S') || n.includes('여름') || n.includes('봄'))) score += 20;
    if (isFW && (n.includes('FW') || n.includes('F/W') || n.includes('겨울') || n.includes('가을'))) score += 20;
    return score;
}

export async function matchExcelBuffer(buffer: Buffer, type: string = 'india', fileName: string = ""): Promise<ExcelJS.Workbook> {
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
        const possibleCols = ['상품코드', '상품명', '바코드', '자체품번', 'ERP코드', '옵션명', '매칭코드'];
        barcodeCols = allCols.filter(c => possibleCols.includes(c) || c.includes('코드') || c.includes('번호'));

        if (type === 'india') {
            // [성능 최적화] 전체 상품을 가져오는 대신, 엑셀에 있는 스타일 번호와 관련된 상품만 필터링해서 가져옴
            const uniqueStyles = Array.from(new Set(excelRecords.map(r => r.styleNo).filter(s => s && s.length >= 3)));
            
            if (uniqueStyles.length > 0) {
                // 스타일 번호가 상품코드나 바코드의 앞부분에 오는 경우가 많으므로 접두어 매칭 활용
                const patterns = uniqueStyles.map(s => `${s}%`);
                const res = await client.query(`
                    SELECT * FROM products 
                    WHERE "상품코드" ILIKE ANY($1) 
                       OR "바코드" ILIKE ANY($1)
                       OR "자체품번" ILIKE ANY($1)
                `, [patterns]);
                dbRows = res.rows;
                
                // 만약 매칭 후보가 너무 적으면 전체 검색을 고려할 수 있으나, 
                // 보통 수입 패킹은 스타일 번호가 기준이므로 이 정도로 충분함
                if (dbRows.length === 0) {
                    // 차선책: 포함 검색 (속도는 조금 느리지만 정확도 향상)
                    const containsPatterns = uniqueStyles.map(s => `%${s}%`);
                    const res2 = await client.query(`
                        SELECT * FROM products 
                        WHERE "상품코드" ILIKE ANY($1) 
                           OR "바코드" ILIKE ANY($1)
                    `, [containsPatterns]);
                    dbRows = res2.rows;
                }
            } else {
                dbRows = [];
            }
        } else {
            // 국내/중국용은 기존 방식 유지 (혹은 나중에 동일하게 최적화 가능)
            const data = await client.query("SELECT * FROM products");
            dbRows = data.rows;
        }
    } finally {
        client.release();
    }

    const finalResults: any[] = [];
    const matchCache = new Map<string, any>();

    for (const record of excelRecords) {
        const cacheKey = `${record.styleNo}|${record.color}|${record.size}`;
        if (matchCache.has(cacheKey)) {
            const cached = matchCache.get(cacheKey);
            finalResults.push({ ...cached, qty: record.qty });
            continue;
        }

        let bestMatch: any = null;
        let maxTotalScore = -1;

        for (const row of dbRows) {
            if (type === 'india') {
                // 인도용 최적화 로직
                const styleScore = getMatchScore(record.styleNo, row, barcodeCols);
                const nameScore = getMatchScore(record.pdfName, row, barcodeCols);
                let baseMatchScore = Math.max(styleScore, nameScore);
                const rowBarcode = normalizeStr(row['바코드'] || '');
                const rowProdCode = normalizeStr(row['상품코드'] || '');
                const recordStyle = normalizeStr(record.styleNo);
                if (recordStyle && ((rowBarcode && rowBarcode.startsWith(recordStyle)) || (rowProdCode && rowProdCode.startsWith(recordStyle)))) {
                    baseMatchScore = Math.max(baseMatchScore, 1.0); 
                }
                if (baseMatchScore < 0.4) continue; 
                const colorScore = getColorScoreIndia(record.color, (row['옵션명'] || '') + (row['옵션'] || ''), row['상품명'] || '');
                const sizeScore = getSizeScoreIndia(record.size, (row['옵션명'] || '') + (row['옵션'] || ''));
                const seasonScore = getSeasonScore(row['상품명'] || '');
                const totalScore = (baseMatchScore * 1000) + (colorScore * 2) + (sizeScore * 2) + seasonScore;
                if (totalScore > maxTotalScore) {
                    maxTotalScore = totalScore;
                    bestMatch = row;
                }
            } else {
                // 국내/중국용 기존 로직 (완전 보존)
                const styleScore = getMatchScore(record.styleNo, row, barcodeCols);
                const nameScore = getMatchScore(record.pdfName, row, barcodeCols);
                let baseMatchScore = Math.max(styleScore, nameScore);
                const rowBarcode = normalizeStr(row['바코드'] || row['상품코드'] || '');
                const recordStyle = normalizeStr(record.styleNo);
                if (recordStyle && rowBarcode && rowBarcode.startsWith(recordStyle)) baseMatchScore = 1.0;
                if (baseMatchScore < 0.4) continue;
                const colorScore = getColorScore(record.color, (row['옵션명'] || '') + (row['상품명'] || ''));
                let sizeScore = 0;
                const dbOption = (row['옵션명'] || '').toUpperCase();
                const targetSize = record.size.toUpperCase().replace(/[^0-9]/g, '');
                if (targetSize && dbOption.includes(targetSize)) sizeScore = 80;
                const seasonScore = getSeasonScore(row['상품명'] || '');
                const totalScore = (baseMatchScore * 1000) + colorScore + sizeScore + seasonScore;
                if (totalScore > maxTotalScore) {
                    maxTotalScore = totalScore;
                    bestMatch = row;
                }
            }
        }

        const threshold = type === 'india' ? 800 : 600;
        const isMatched = bestMatch && maxTotalScore > threshold;
        const resultItem = {
            productCode: isMatched ? bestMatch['상품코드'] : '미매칭',
            sheetName: isMatched ? bestMatch['상품명'] : record.pdfName,
            color: record.color,
            size: record.size,
            qty: record.qty,
            originalKeys: [record.styleNo]
        };

        matchCache.set(cacheKey, resultItem);
        finalResults.push(resultItem);
    }

    finalResults.sort((a, b) => {
        if (a.originalKeys[0] !== b.originalKeys[0]) return a.originalKeys[0].localeCompare(b.originalKeys[0]);
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        const getS = (s:string) => parseInt(s.replace(/[^0-9]/g, '')) || 0;
        return getS(a.size) - getS(b.size);
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('매칭결과');
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    let memoContent = `${memoDate}_인도 입고`;
    if (type === 'china') {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
        let filePart = "";
        const dateMatch = cleanFileName.match(/[0-9]{8}/);
        if (dateMatch) filePart = cleanFileName.replace(dateMatch[0], dateMatch[0].substring(4));
        else filePart = cleanFileName;
        memoContent = `${memoDate}_${filePart} 중국 패킹 입고`;
    } else if (type === 'domestic') memoContent = `${memoDate}_국내 패킹 입고`;

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
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } };
    
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
        if (r.productCode === '미매칭') row.eachCell(c => { c.font = { color: { argb: 'FFFF0000' } }; });
    });

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    return outWb;
}
