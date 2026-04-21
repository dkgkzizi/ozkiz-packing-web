import ExcelJS from 'exceljs';
import pool from '@/lib/db';

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
    // 특수문자 제거하되 공백은 한 개로 표준화 (한글 포함)
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
    
    // 1. 완전 일치 (정규화 후)
    if (s1 === s2 || s1_clean === s2_clean) return 1.0;
    
    // 2. 포함 관계 (한글/영문 모두 포함, 최소 3글자 이상인 경우 0.95 부여)
    if (s1_clean && s2_clean && (s1_clean.length >= 3 || s2_clean.length >= 3)) {
        if (s1_clean.includes(s2_clean) || s2_clean.includes(s1_clean)) return 0.95;
    }
    
    // 3. 토큰 기반 매칭 (정확히 일치하는 단어가 있을 때만)
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

function getMatchScore(style: string, dbRow: any, barcodeCols: string[], type: string = 'india'): number {
    const s = normalizeStr(style);
    if (!s) return 0;

    let maxScore = 0;
    // 인도와 중국 모두 이름 기반 매칭이므로 0.7로 완화하여 오타/누락 대응
    const threshold = 0.7; 

    for (const key of barcodeCols) {
        const val = normalizeStr(dbRow[key]);
        if (!val) continue;

        const similarity = getSimilarity(s, val);
        if (similarity < threshold) continue;

        // 이름 점수를 기본으로 하고 크게 비중을 둠
        let currentScore = similarity * 1000;
        if (currentScore > maxScore) maxScore = currentScore;
    }
    return maxScore;
}

function getSeasonalScore(dbName: string): number {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear().toString().slice(-2); // "24"
    
    let score = 0;
    const n = dbName.toUpperCase();
    
    // 연도 매칭 (현재 연도 포함 시 가점)
    if (n.includes(year)) score += 30;
    if (n.includes(String(parseInt(year) - 1))) score += 10; // 작년 제품도 약간의 가점

    // 시즌 매칭 (SS/FW)
    const isSS = month >= 2 && month <= 7; // 봄/여름 시즌 작업 기간
    const isFW = month >= 8 || month <= 1; // 가을/겨울 시즌 작업 기간
    
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
        
        if (type === 'china') {
            // 중국은 상품명 매칭이 핵심이므로 상품명 컬럼만 우선 조회 (옵션/코드로 오매칭되는 것 방지)
            barcodeCols = allCols.filter(c => ['상품명', 'name'].some(k => c.toLowerCase().includes(k)));
            // 만약 상품명 컬럼이 없으면 폴백
            if (barcodeCols.length === 0) barcodeCols = ['상품명', '상품코드', '옵션'].filter(c => allCols.includes(c));
        } else {
            // 인도패킹은 바코드가 중요하지만, 상품명으로도 검색할 수 있어야 함
            barcodeCols = allCols.filter(c => ['바코드', 'barcode', 'sku', '상품명', 'name'].some(k => c.toLowerCase().includes(k)));
            if (barcodeCols.length === 0) barcodeCols = ['상품코드', '상품명'].filter(c => allCols.includes(c));
        }
        
        // 정렬 기준을 'id'에서 '업로드일시'로 변경하여 에러 수정
        const result = await client.query('SELECT * FROM products ORDER BY "업로드일시" DESC NULLS LAST');
        dbRows = result.rows;
    } finally {
        client.release();
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        let candidates: any[] = [];
        const normalizedExColor = ex.color.toUpperCase().trim();

        for (let row of dbRows) {
            const baseScore = getMatchScore(ex.styleNo, row, barcodeCols, type);
            // 베이스 점수(이름 유사도)가 임계치를 넘지 못하면 아예 후보에서 제외
            if (baseScore < 500) continue; // 최소 0.5 유사도

            let colorScore = 0;
            const dbOpt = (row["옵션"] || "").toString().toUpperCase();
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (normalizedExColor.includes(group) || synonyms.some(s => normalizedExColor.includes(s))) {
                    if ([group, ...synonyms].some(t => dbOpt.includes(t))) {
                        colorScore = 100; break; // 색상 일치 시 가산점
                    }
                }
            }

            const dbName = (row["상품명"] || row["name"] || "").toString();
            const dbCode = (row["상품코드"] || row["code"] || "").toString();
            let qualityScore = (dbName && dbName !== dbCode && dbName.length > 2) ? 50 : 0;
            
            // 라벨/부자재(부수자재) 오매칭 방지 로직 (강력한 필터링)
            const subItemKeywords = ['라벨', '택', 'LABEL', 'TAG', '보증택', '고리', '옷걸이', '봉투', '박스', '비닐', '폴리백', '사은품'];
            const s = normalizeStr(ex.styleNo);
            const s_upper = s.toUpperCase();
            const dbName_upper = dbName.toUpperCase();
            
            const inputIsSubItem = subItemKeywords.some(k => s_upper.includes(k));
            const dbIsSubItem = subItemKeywords.some(k => dbName_upper.includes(k));
            
            if (inputIsSubItem !== dbIsSubItem) {
                // 한쪽만 부자재일 경우, 점수를 대폭 삭감하여 아예 매칭되지 않도록 함 (중복 방지 정책)
                qualityScore -= 500; 
            } else if (inputIsSubItem && dbIsSubItem) {
                // 둘 다 부자재일 경우 가산점
                qualityScore += 100;
            }
            
            // 중국 및 국내일 경우 시즌 가산점 추가
            let seasonalScore = (type === 'china' || type === 'domestic') ? getSeasonalScore(dbName) : 0;
            
            // 사이즈 매칭 가산점 (국내 패킹에서 중요)
            let sizeScore = 0;
            const exSize = String(ex.size).toUpperCase().trim();
            if (exSize && dbOpt.includes(exSize)) {
                sizeScore = 200; // 사이즈 일치 시 강력한 우선순위 부여
            }

            candidates.push({ row, score: baseScore + colorScore + sizeScore + qualityScore + seasonalScore, nameScore: qualityScore });
        }

        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates[0];
        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestCandidate && bestCandidate.score >= 500) { // 최소 50% 이상의 이름 유사도 보장 (유사도 0.5 * 1000 = 500)
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

            let finalName = bestMatch["상품명"] || bestMatch["name"] || '상품명누락';
            if (bestCandidate.nameScore === 0) {
                const legacyMatch = candidates.find(c => c.nameScore > 0);
                if (legacyMatch) finalName = legacyMatch.row["상품명"] || legacyMatch.row["name"];
            }

            if (finalName === bestMatch["상품코드"] || finalName.length < 2) {
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
    
    let memoContent = `${memoDate}_인도 입고`;
    if (type === 'china') {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
        let filePart = "";
        const dateMatch = cleanFileName.match(/[0-9]{8}/);
        if (dateMatch) {
            filePart = cleanFileName.replace(dateMatch[0], dateMatch[0].substring(4));
        } else {
            filePart = cleanFileName;
        }
        memoContent = `${memoDate}_${filePart} 중국 패킹 입고`;
    } else if (type === 'domestic') {
        memoContent = `${memoDate}_국내 패킹 입고`;
    }

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