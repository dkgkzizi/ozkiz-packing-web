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
    // 특수문자 제거하되 공백은 한 개로 유지(추후 제거)
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
    
    // 1. 완전 일치 (정규화 전/후)
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

        const score = getSimilarity(s, val);
        if (score > maxScore) maxScore = score;
    }

    return maxScore >= threshold ? maxScore : 0;
}

export function getColorScore(styleColor: string, dbColor: string): number {
    const sc = styleColor.toUpperCase();
    const dc = dbColor.toUpperCase();

    if (sc === dc) return 100;
    if (sc.includes(dc) || dc.includes(sc)) return 80;

    // 매핑 테이블 확인
    for (const [key, aliases] of Object.entries(COLOR_MAP)) {
        if (sc.includes(key) || aliases.some(a => sc.includes(a))) {
            if (dc.includes(key) || aliases.some(a => dc.includes(a))) {
                return 70;
            }
        }
    }

    return 0;
}

export function getSeasonScore(name: string): number {
    const month = new Date().getMonth() + 1;
    const n = name.toUpperCase();
    let score = 0;

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
        
        const possibleCols = ['상품코드', '상품명', '바코드', '자체품번', 'ERP코드', '옵션명', '매칭코드'];
        barcodeCols = allCols.filter(c => possibleCols.includes(c) || c.includes('코드') || c.includes('번호'));

        const data = await client.query("SELECT * FROM products");
        dbRows = data.rows;
    } finally {
        client.release();
    }

    const finalResults: any[] = [];

    for (const record of excelRecords) {
        let bestMatch: any = null;
        let maxTotalScore = -1;

        for (const row of dbRows) {
            // 1. 스타일 넘버 및 상품명 매칭 (바코드 우선)
            const styleScore = getMatchScore(record.styleNo, row, barcodeCols, type);
            const nameScore = getMatchScore(record.pdfName, row, barcodeCols, type);
            let baseMatchScore = Math.max(styleScore, nameScore);

            // [인도 패킹 특화] 스타일 넘버가 바코드의 시작 부분과 일치하면 만점 부여
            const rowBarcode = normalizeStr(row['바코드'] || row['상품코드'] || '');
            const recordStyle = normalizeStr(record.styleNo);
            if (recordStyle && rowBarcode && rowBarcode.startsWith(recordStyle)) {
                baseMatchScore = 1.0; 
            }

            if (baseMatchScore < 0.3) continue; // 최소 하한치

            // 2. 컬러 매칭
            const colorScore = getColorScore(record.color, (row['옵션명'] || '') + (row['상품명'] || ''));

            // 3. 사이즈 매칭 (추가)
            let sizeScore = 0;
            const dbOption = (row['옵션명'] || '').toUpperCase();
            const targetSize = record.size.toUpperCase().replace(/[^0-9]/g, ''); // 숫자만 추출 (예: 100)
            if (targetSize && dbOption.includes(targetSize)) {
                sizeScore = 50; // 사이즈 일치 시 보너스
            }

            const seasonScore = getSeasonScore(row['상품명'] || '');
            
            // [가중치 개편] baseMatchScore에 1000을 곱해 스타일 불일치를 컬러/사이즈가 역전하지 못하게 함
            const totalScore = (baseMatchScore * 1000) + colorScore + sizeScore + seasonScore;

            if (totalScore > maxTotalScore) {
                maxTotalScore = totalScore;
                bestMatch = row;
            }
        }

        if (bestMatch && maxTotalScore > 500) { // 하한치 상향
            finalResults.push({
                productCode: bestMatch['상품코드'],
                sheetName: bestMatch['상품명'],
                color: record.color,
                size: record.size,
                qty: record.qty,
                originalKeys: [record.styleNo]
            });
        } else {
            finalResults.push({
                productCode: '미매칭',
                sheetName: record.pdfName,
                color: record.color,
                size: record.size,
                qty: record.qty,
                originalKeys: [record.styleNo]
            });
        }
    }

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
