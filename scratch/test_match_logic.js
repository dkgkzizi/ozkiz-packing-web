function normalizeStr(s) {
    if (!s) return "";
    return s.toString()
        .replace(/[^0-9A-Z가-힣]/gi, '')
        .toUpperCase();
}

function getLevenshteinDistance(s1, s2) {
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

function getSimilarity(s1, s2) {
    const s1_clean = s1.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
    const s2_clean = s2.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
    if (s1 === s2 || s1_clean === s2_clean) return 1.0;
    
    const distance = getLevenshteinDistance(s1_clean, s2_clean);
    const maxLen = Math.max(s1_clean.length, s2_clean.length);
    if (maxLen === 0) return 1;
    return 1 - distance / maxLen;
}

const COLOR_MAP = {
    'BLACK': ['블랙', '검정', '검정색'],
    'BROWN': ['브라운', '갈색', '코코아'],
    // ... rest of map omitted for brevity or added if needed
};

function getColorScoreIndia(styleColor, dbOption, dbName) {
    const sc = styleColor.toUpperCase().trim();
    const target = (dbOption + dbName).toUpperCase();
    if (!sc) return 0;
    if (target.includes(sc)) return 100;
    const aliases = COLOR_MAP[sc] || [];
    if (aliases.some(a => target.includes(a))) return 80;
    return 0;
}

function getSizeScoreIndia(recordSize, dbOption) {
    const rs = recordSize.toUpperCase().trim();
    const dos = dbOption.toUpperCase().trim();
    if (!rs || !dos) return 0;
    if (dos.includes(rs)) return 100;
    return 0;
}

const record = {
    styleNo: "TOP AND BTM",
    pdfName: "TOP AND BTM",
    color: "BLACK",
    size: "100"
};

const dbRow = {
    "상품코드": "S158260",
    "상품명": "(세트-골지)",
    "옵션": ":블랙, :100",
    "바코드": "O26WT03BC600BK100"
};

console.log('--- Testing Match Score ---');
const nameScore = getSimilarity(record.pdfName, dbRow["상품명"]);
const styleScore = getSimilarity(record.styleNo, dbRow["상품코드"]);
const baseMatchScore = Math.max(nameScore, styleScore);
const colorScore = getColorScoreIndia(record.color, dbRow["옵션"], dbRow["상품명"]);
const sizeScore = getSizeScoreIndia(record.size, dbRow["옵션"]);
const totalScore = (baseMatchScore * 10000) + (colorScore * 10) + (sizeScore * 10);

console.log(`Name Similarity ("${record.pdfName}" vs "${dbRow["상품명"]}"):`, nameScore.toFixed(4));
console.log('Base Match Score:', baseMatchScore.toFixed(4));
console.log('Color Score:', colorScore);
console.log('Size Score:', sizeScore);
console.log('Total Score:', totalScore.toFixed(0));
console.log('Threshold:', 4000);
console.log('Is Matched:', totalScore > 4000);
