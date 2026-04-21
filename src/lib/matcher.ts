import ExcelJS from 'exceljs';
import pool from '@/lib/db';

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['?꾩씠蹂대━', '?붿씠??, '?щ┝', '諛깆븘?대낫由?],
    'WHITE': ['?붿씠??, '?꾩씠蹂대━', '諛깆븘?대낫由?, '?곗깋'],
    'BLACK': ['釉붾옓', '寃??, '寃?뺤깋'],
    'PINK': ['?묓겕', '遺꾪솉', '?ロ븨??, '?고븨??],
    'YELLOW': ['?먮줈??, '?몃옉'],
    'MELANGE': ['硫쒕?吏', '?뚯깋', '洹몃젅??, 'G MEL', 'MEL', 'GMEL'],
    'GRAY': ['洹몃젅??, '?뚯깋', '硫쒕?吏'],
    'GREY': ['洹몃젅??, '?뚯깋', '硫쒕?吏'],
    'BEIGE': ['踰좎씠吏', '?ㅽ듃諛'],
    'BLUE': ['釉붾（', '?뚮옉', '誘쇳듃', '?뚮씪', 'S BLUE', 'SKY BLUE'],
    'NAVY': ['?ㅼ씠鍮?, '?⑥깋'],
    'RED': ['?덈뱶', '鍮④컯', '???],
    'GREEN': ['洹몃┛', '珥덈줉'],
    'PURPLE': ['?쇳뵆', '蹂대씪', '?쇰깽??],
    'CHARCOAL': ['李⑥퐳', '癒뱀깋'],
    'CORAL': ['肄붾엫'],
    'PEACH': ['?쇱튂'],
    'BROWN': ['釉뚮씪??, '媛덉깋', '肄붿퐫??],
    'LIME': ['?쇱엫', '?곕몢'],
    'ORANGE': ['?ㅻ젋吏', '二쇳솴']
};

function decomposeHangul(str: string): string {
    const CHOSUNG = ['??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??];
    const JUNGSUNG = ['??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??];
    const JONGSUNG = ['', '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '?', '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??, '??];
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
    // ?뱀닔臾몄옄 ?쒓굅?섎릺 怨듬갚? ??媛쒕줈 ?쒖???(?쒓? ?ы븿)
    return s.toString().replace(/[^0-9A-Z媛-??/gi, ' ').replace(/\s+/g, '').toUpperCase();
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
    const s1_clean = s1.toUpperCase().replace(/[^0-9A-Z媛-??/g, '');
    const s2_clean = s2.toUpperCase().replace(/[^0-9A-Z媛-??/g, '');
    
    // 1. ?꾩쟾 ?쇱튂 (?뺢퇋????
    if (s1 === s2 || s1_clean === s2_clean) return 1.0;
    
    // 2. ?ы븿 愿怨?(?쒓?/?곷Ц 紐⑤몢 ?ы븿, 理쒖냼 3湲???댁긽??寃쎌슦 0.95 遺??
    if (s1_clean && s2_clean && (s1_clean.length >= 3 || s2_clean.length >= 3)) {
        if (s1_clean.includes(s2_clean) || s2_clean.includes(s1_clean)) return 0.95;
    }
    
    // 3. ?좏겙 湲곕컲 留ㅼ묶 (?뺥솗???쇱튂?섎뒗 ?⑥뼱媛 ?덉쓣 ?뚮쭔)
    const tokens1 = s1.split(/[^0-9A-Z媛-??/).filter(t => t.length >= 2);
    const tokens2 = s2.split(/[^0-9A-Z媛-??/).filter(t => t.length >= 2);
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
    // ?몃룄? 以묎뎅 紐⑤몢 ?대쫫 湲곕컲 留ㅼ묶?대?濡?0.7濡??꾪솕?섏뿬 ?ㅽ?/?꾨씫 ???    const threshold = 0.7; 

    for (const key of barcodeCols) {
        const val = normalizeStr(dbRow[key]);
        if (!val) continue;

        const similarity = getSimilarity(s, val);
        if (similarity < threshold) continue;

        // ?대쫫 ?먯닔瑜?湲곕낯?쇰줈 ?섍퀬 ?ш쾶 鍮꾩쨷????        let currentScore = similarity * 1000;
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
    
    // ?곕룄 留ㅼ묶 (?꾩옱 ?곕룄 ?ы븿 ??媛??
    if (n.includes(year)) score += 30;
    if (n.includes(String(parseInt(year) - 1))) score += 10; // ?묐뀈 ?쒗뭹???쎄컙??媛??
    // ?쒖쫵 留ㅼ묶 (SS/FW)
    const isSS = month >= 2 && month <= 7; // 遊??щ쫫 ?쒖쫵 ?묒뾽 湲곌컙
    const isFW = month >= 8 || month <= 1; // 媛??寃⑥슱 ?쒖쫵 ?묒뾽 湲곌컙
    
    if (isSS && (n.includes('SS') || n.includes('S/S') || n.includes('?щ쫫') || n.includes('遊?))) score += 20;
    if (isFW && (n.includes('FW') || n.includes('F/W') || n.includes('寃⑥슱') || n.includes('媛??))) score += 20;
    
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
        if (!styleNo || styleNo.includes('?⑷퀎') || styleNo === 'STYLE NO' || styleNo.includes('TOTAL')) return;
        
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
            // 以묎뎅? ?곹뭹紐?留ㅼ묶???듭떖?대?濡??곹뭹紐?而щ읆留??곗꽑 議고쉶 (?듭뀡/肄붾뱶濡??ㅻℓ移?릺??寃?諛⑹?)
            barcodeCols = allCols.filter(c => ['?곹뭹紐?, 'name'].some(k => c.toLowerCase().includes(k)));
            // 留뚯빟 ?곹뭹紐?而щ읆???놁쑝硫??대갚
            if (barcodeCols.length === 0) barcodeCols = ['?곹뭹紐?, '?곹뭹肄붾뱶', '?듭뀡'].filter(c => allCols.includes(c));
        } else {
            // ?몃룄?⑦궧? 諛붿퐫?쒓? 以묒슂?섏?留? ?곹뭹紐낆쑝濡쒕룄 寃?됲븷 ???덉뼱????            barcodeCols = allCols.filter(c => ['諛붿퐫??, 'barcode', 'sku', '?곹뭹紐?, 'name'].some(k => c.toLowerCase().includes(k)));
            if (barcodeCols.length === 0) barcodeCols = ['?곹뭹肄붾뱶', '?곹뭹紐?].filter(c => allCols.includes(c));
        }
        
        // ?뺣젹 湲곗???'id'?먯꽌 '?낅줈?쒖씪??濡?蹂寃쏀븯???먮윭 ?섏젙
        const result = await client.query('SELECT * FROM products ORDER BY "?낅줈?쒖씪?? DESC NULLS LAST');
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
            // 踰좎씠???먯닔(?대쫫 ?좎궗??媛 ?꾧퀎移섎? ?섏? 紐삵븯硫??꾩삁 ?꾨낫?먯꽌 ?쒖쇅
            if (baseScore < 500) continue; // 理쒖냼 0.5 ?좎궗??
            let colorScore = 0;
            const dbOpt = (row["?듭뀡"] || "").toString().toUpperCase();
            for (const [group, synonyms] of Object.entries(COLOR_MAP)) {
                if (normalizedExColor.includes(group) || synonyms.some(s => normalizedExColor.includes(s))) {
                    if ([group, ...synonyms].some(t => dbOpt.includes(t))) {
                        colorScore = 100; break; // ?됱긽 ?쇱튂 ??媛?곗젏
                    }
                }
            }

            const dbName = (row["?곹뭹紐?] || row["name"] || "").toString();
            const dbCode = (row["?곹뭹肄붾뱶"] || row["code"] || "").toString();
            let qualityScore = (dbName && dbName !== dbCode && dbName.length > 2) ? 50 : 0;
            
            // ?쇰꺼/遺?먯옱(遺?섏옄?? ?ㅻℓ移?諛⑹? 濡쒖쭅 (媛뺣젰???꾪꽣留?
            const subItemKeywords = ['?쇰꺼', '??, 'LABEL', 'TAG', '蹂댁쬆??, '怨좊━', '?룰구??, '遊됲닾', '諛뺤뒪', '鍮꾨땺', '?대━諛?, '?ъ???];
            const s = normalizeStr(ex.styleNo);
            const s_upper = s.toUpperCase();
            const dbName_upper = dbName.toUpperCase();
            
            const inputIsSubItem = subItemKeywords.some(k => s_upper.includes(k));
            const dbIsSubItem = subItemKeywords.some(k => dbName_upper.includes(k));
            
            if (inputIsSubItem !== dbIsSubItem) {
                // ?쒖そ留?遺?먯옱??寃쎌슦, ?먯닔瑜??????컧?섏뿬 ?꾩삁 留ㅼ묶?섏? ?딅룄濡???(以묐났 諛⑹? ?뺤콉)
                qualityScore -= 500; 
            } else if (inputIsSubItem && dbIsSubItem) {
                // ????遺?먯옱??寃쎌슦 媛?곗젏
                qualityScore += 100;
            }
            
            // 以묎뎅 諛?援?궡??寃쎌슦 ?쒖쫵 媛?곗젏 異붽?
            let seasonalScore = (type === 'china' || type === 'domestic') ? getSeasonalScore(dbName) : 0;
            
            // ?ъ씠利?留ㅼ묶 媛?곗젏 (援?궡 ?⑦궧?먯꽌 以묒슂)
            let sizeScore = 0;
            const exSize = String(ex.size).toUpperCase().trim();
            if (exSize && dbOpt.includes(exSize)) {
                sizeScore = 200; // ?ъ씠利??쇱튂 ??媛뺣젰???곗꽑?쒖쐞 遺??            }

            candidates.push({ row, score: baseScore + colorScore + sizeScore + qualityScore + seasonalScore, nameScore: qualityScore });
        }

        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates[0];
        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestCandidate && bestCandidate.score >= 500) { // 理쒖냼 50% ?댁긽???대쫫 ?좎궗??蹂댁옣 (?좎궗??0.5 * 1000 = 500)
            const bestMatch = bestCandidate.row;
            let korColor = ex.color;
            const optVal = (bestMatch["?듭뀡"] || "").toString();
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

            let finalName = bestMatch["?곹뭹紐?] || bestMatch["name"] || '?곹뭹紐낅늻??;
            if (bestCandidate.nameScore === 0) {
                const legacyMatch = candidates.find(c => c.nameScore > 0);
                if (legacyMatch) finalName = legacyMatch.row["?곹뭹紐?] || legacyMatch.row["name"];
            }

            if (finalName === bestMatch["?곹뭹肄붾뱶"] || finalName.length < 2) {
                finalName = (ex.pdfName && ex.pdfName.length > 2) ? ex.pdfName : finalName;
            }

            matchedRaw.push({
                productCode: bestMatch["?곹뭹肄붾뱶"] || bestMatch["code"] || '肄붾뱶?꾨씫',
                sheetName: finalName,
                color: korColor, size: ex.size, qty: ex.qty,
                originalKey: originalKey
            });
        } else {
            matchedRaw.push({
                productCode: '誘몃ℓ移?,
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
        if (a.productCode === '誘몃ℓ移? && b.productCode !== '誘몃ℓ移?) return 1;
        if (a.productCode !== '誘몃ℓ移? && b.productCode === '誘몃ℓ移?) return -1;
        return a.sheetName.localeCompare(b.sheetName);
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('留ㅼ묶寃곌낵');
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    let memoContent = `${memoDate}_?몃룄 ?낃퀬`;
    if (type === 'china') {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
        let filePart = "";
        const dateMatch = cleanFileName.match(/[0-9]{8}/);
        if (dateMatch) {
            filePart = cleanFileName.replace(dateMatch[0], dateMatch[0].substring(4));
        } else {
            filePart = cleanFileName;
        }
        memoContent = `${memoDate}_${filePart} 以묎뎅 ?⑦궧 ?낃퀬`;
    } else if (type === 'domestic') {
        memoContent = `${memoDate}_援?궡 ?⑦궧 ?낃퀬`;
    }

    outWs.columns = [
        { header: '?곹뭹肄붾뱶', key: 'productCode', width: 20 },
        { header: '?곹뭹紐?, key: 'sheetName', width: 40 },
        { header: '?됱긽', key: 'color', width: 15 },
        { header: '?ъ씠利?, key: 'size', width: 12 },
        { header: '?묒뾽?섎웾', key: 'qty', width: 15 },
        { header: '硫붾え', key: 'memo', width: 25 },
        { header: '?앸퀎??, key: 'originalKey', width: 35, hidden: true }
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
        if (r.productCode === '誘몃ℓ移?) {
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
