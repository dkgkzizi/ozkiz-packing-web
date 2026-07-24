import ExcelJS from 'exceljs';
import pool from '@/lib/db';

function normalizeStr(s: any) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z가-힣]/gi, '').toUpperCase();
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

const STANDARD_COLORS = Array.from(new Set([
    ...Object.keys(COLOR_MAP),
    ...Object.values(COLOR_MAP).flat()
]));

// "(인디)" 상품군은 패킹리스트의 표기 사이즈와 마스터 DB 등록 사이즈가 40 차이로 어긋난다.
const INDI_SIZE_REMAP: Record<string, string> = {
    '100': '140',
    '110': '150',
    '120': '160',
    '130': '170'
};

function getLevenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,    // deletion
                    matrix[i][j - 1] + 1,    // insertion
                    matrix[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }
    return matrix[a.length][b.length];
}

function normalizeColor(color: string): string {
    if (!color) return "";
    let trimmed = color.trim();
    
    if (STANDARD_COLORS.includes(trimmed)) {
        return trimmed;
    }

    const typoMap: Record<string, string> = {
        '옐러우': '옐로우',
        '엘로우': '옐로우',
        '옐라우': '옐로우',
        '옐로': '옐로우',
        '옐로루': '옐로우',
        '옐로오': '옐로우',
        '챠콜': '차콜',
        '배이지': '베이지',
        '아아보리': '아이보리',
        '메란지': '멜란지',
        '퍼풀': '퍼플',
        '브라움': '브라운',
        '브라웅': '브라운',
        '하이트': '화이트',
        '블렉': '블랙',
        '블락': '블랙',
        '핑크': '핑크',
        '핀크': '핑크'
    };
    
    if (typoMap[trimmed]) {
        return typoMap[trimmed];
    }

    let bestMatch = trimmed;
    let minDistance = Infinity;

    for (const standard of STANDARD_COLORS) {
        const dist = getLevenshteinDistance(trimmed, standard);
        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = standard;
        }
    }

    if (minDistance <= 1) {
        return bestMatch;
    }

    return trimmed;
}

export async function matchExcelBuffer(buffer: Buffer, type: string = 'india', fileName: string = ""): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const excelRecords: any[] = [];
    let lastStyle = "";
    let lastName = "";
    let lastSheet = "";

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        if (!row) continue;
        
        let styleNo = row.getCell(1).text.trim();
        let pdfName = row.getCell(2).text.trim();
        const color = row.getCell(3).text.trim();
        const size = row.getCell(4).text.trim();
        const qty = parseInt(row.getCell(5).value as any) || 0;
        let sheetName = row.getCell(6).text.trim() || fileName;
        const boxNo = row.getCell(7).text.trim() || '';
        const boxCount = row.getCell(8).text.trim() || '';

        // 병합 셀 대응: 비어 있으면 이전 행의 값 사용
        if (!styleNo && lastStyle) styleNo = lastStyle;
        if (!pdfName && lastName) pdfName = lastName;
        if (!sheetName && lastSheet) sheetName = lastSheet;

        if (styleNo) lastStyle = styleNo;
        if (pdfName) lastName = pdfName;
        if (sheetName) lastSheet = sheetName;

        // 박스 번호가 있는 행은 절대 버리지 않음 (데이터 유실 방지)
        if (!styleNo && !boxNo) continue;
        if (styleNo && styleNo.includes('합계')) continue;
        if (pdfName && pdfName.includes('합계')) continue;

        excelRecords.push({
            styleNo: styleNo || 'UNKNOWN',
            pdfName,
            color,
            size,
            qty,
            sheetName,
            boxNo,
            boxCount
        });
    }

    const client = await pool.connect();
    let dbRows: any[] = [];
    let historyRows: any[] = [];

    try {
        const uniqueStyles = Array.from(new Set(excelRecords.map(r => r.styleNo).filter(s => s && s.length >= 2)));
        const normalizedStyles = new Set(uniqueStyles.map(normalizeStr));
        const uniqueNames = Array.from(new Set(
            excelRecords
                .map(r => r.pdfName)
                .filter(n => n && n.length >= 2 && !normalizedStyles.has(normalizeStr(n)))
        ));
        const searchTerms = [...uniqueStyles, ...uniqueNames];

        if (searchTerms.length > 0) {
            const patterns = searchTerms.map(s => `%${normalizeStr(s)}%`);
            const historyRes = await client.query(`
                SELECT original_style, product_code, matched_name FROM matching_history 
                WHERE original_style = ANY($1)
            `, [uniqueStyles]);
            historyRows = historyRes.rows;

            // 학습된 코드가 있으면 해당 코드들과 '상품명' 전체를 조회 대상에 명시적으로 추가
            const learnedCodes = Array.from(new Set(historyRows.map(h => h.product_code)));
            const learnedNames = Array.from(new Set(historyRows.map(h => h.matched_name)));
            
            const res = await client.query(`
                SELECT "상품명", "상품코드", "바코드", "옵션" FROM products 
                WHERE (
                    REGEXP_REPLACE("바코드", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1) 
                    OR REGEXP_REPLACE("상품코드", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1)
                    OR REGEXP_REPLACE("상품명", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1)
                    OR REGEXP_REPLACE("옵션", '[^a-zA-Z0-9가-힣]', '', 'g') ILIKE ANY($1)
                    OR "상품코드" = ANY($2)
                    OR "상품명" = ANY($3)
                )
                ORDER BY "상품코드" ASC
            `, [
                patterns, 
                learnedCodes.length > 0 ? learnedCodes : ['EMPTY_PLACEHOLDER'],
                learnedNames.length > 0 ? learnedNames : ['EMPTY_PLACEHOLDER']
            ]);
            dbRows = res.rows;
        }
    } finally {
        client.release();
    }

    const finalResults = excelRecords.map(record => {
        // 학습 데이터 존재 여부 확인 (스타일 + 색상 + 사이즈 정확히 일치하는 기록 우선)
        const learned = historyRows.find(h => 
            h.original_style === record.styleNo && 
            (h.color === record.color || (!h.color && !record.color)) &&
            (h.size === record.size || (!h.size && !record.size))
        ) || historyRows.find(h => h.original_style === record.styleNo); // Fallback to style-only match
        
        const nStyle = normalizeStr(record.styleNo);
        const nName = normalizeStr(record.pdfName || '');
        let bestMatch: any = null;
        let bestScore = -1;
        let tiedMatches: any[] = [];
        let bestSizeMatched = false;
        let bestColorMatched = false;

        dbRows.forEach(row => {
            let score = 0;
            const dbName = normalizeStr(row['상품명']);
            const dbCode = normalizeStr(row['상품코드']);
            const dbBarcode = normalizeStr(row['바코드']);
            const dbOption = normalizeStr(row['옵션'] || '');

            // 0. AI 학습 가중치
            if (learned) {
                // 이름이 같으면 기본 가산점
                if (row['상품명'] === learned.matched_name) score += 50;

                // 스타일만 매칭된 경우(Fallback) 코드에 보너스를 주지 않음
                // [색상 + 사이즈]까지 완벽히 일치하는 히스토리일 때만 코드에 강력한 보너스 부여
                const isExactSkuHistory = (learned.color === record.color && learned.size === record.size);
                if (row['상품코드'] === learned.product_code && isExactSkuHistory) {
                    // 과거 수동교정이 오클릭 등으로 잘못 저장됐을 수 있으므로, 학습된 색상/사이즈가
                    // 실제 이 상품의 옵션/바코드에 정말 존재하는지 검증한 뒤에만 절대 우선순위를 부여한다.
                    const nLearnedSize = learned.size ? normalizeStr(learned.size) : '';
                    const nLearnedColor = learned.color ? normalizeStr(normalizeColor(learned.color)) : '';
                    const learnedSizeHolds = !nLearnedSize || dbOption.includes(nLearnedSize) || dbBarcode.includes(nLearnedSize);
                    const learnedColorHolds = !nLearnedColor || dbOption.includes(nLearnedColor) || dbBarcode.includes(nLearnedColor);
                    if (learnedSizeHolds && learnedColorHolds) {
                        score += 100; // 절대적인 우선순위
                    }
                }
            }

            // 1. 기본 매칭 (스타일/상품명 일치)
            let isBaseMatch = false;
            if (
                dbName === nStyle || dbCode === nStyle || dbBarcode === nStyle ||
                (nName && (dbName === nName || dbCode === nName || dbBarcode === nName))
            ) {
                score += 30; // 정확히 일치하는 경우 높은 가산점
                isBaseMatch = true;
            } else if (
                dbName.includes(nStyle) || dbCode.includes(nStyle) || dbBarcode.includes(nStyle) || dbOption.includes(nStyle) ||
                (nName && (dbName.includes(nName) || dbCode.includes(nName) || dbBarcode.includes(nName) || dbOption.includes(nName)))
            ) {
                score += 10;
                isBaseMatch = true;
            } else {
                // '아쿠아슈즈-요요' -> '아쿠아-요요' 매칭을 위해 '슈즈', '신발' 등 노이즈 제거 후 재시도
                const cleanedStyle = nStyle.replace(/슈즈|신발|샌들|장화|구두/g, '');
                if (cleanedStyle.length >= 2 && (dbName === cleanedStyle || dbCode === cleanedStyle || dbOption === cleanedStyle)) {
                    score += 20;
                    isBaseMatch = true;
                } else if (cleanedStyle.length >= 2 && (
                    dbName.includes(cleanedStyle) || dbCode.includes(cleanedStyle) || dbOption.includes(cleanedStyle)
                )) {
                    score += 8; // 노이즈 제거 매칭은 약간 낮은 점수
                    isBaseMatch = true;
                }
            }

            // 학습 데이터가 없고 이름 매칭도 실패했다면 제외
            // 학습 데이터가 있더라도 (학습된 코드와 다름) AND (이름 매칭 실패)라면 제외
            const isLearnedCodeMatch = learned && row['상품코드'] === learned.product_code;
            if (!isLearnedCodeMatch && !isBaseMatch) {
                return;
            }

            // 2. 사이즈 매칭 (가중치 강화)
            // 주의: dbName/dbCode는 검사하지 않는다 — 상품코드는 임의의 일련번호라
            // 스타일 패밀리 번호가 실제 사이즈 값과 우연히 겹칠 수 있다(예: S140044~S140048
            // 시리즈에서 사이즈 140과 코드 앞자리 "140"이 겹쳐 전부 오매칭되던 버그).
            let sizeMatched = !record.size; // 사이즈 정보가 없으면 통과 처리
            if (record.size) {
                // "(인디)" 상품군은 패킹리스트 표기 사이즈와 마스터 DB 등록 사이즈가
                // 40 차이로 어긋나 있다(100→140, 110→150, 120→160, 130→170).
                const isIndiProduct = (row['상품명'] || '').includes('(인디)');
                const effectiveSize = isIndiProduct && INDI_SIZE_REMAP[record.size]
                    ? INDI_SIZE_REMAP[record.size]
                    : record.size;
                const nSize = normalizeStr(effectiveSize);
                if (nSize && (dbBarcode.includes(nSize) || dbOption.includes(nSize))) {
                    score += 40;
                    sizeMatched = true;
                }
            }

            // 3. 색상 매칭 (가중치 강화)
            let colorMatched = !record.color;
            if (record.color) {
                const normalizedColorVal = normalizeColor(record.color);
                const nColor = normalizeStr(normalizedColorVal);
                const upperColor = normalizedColorVal.toUpperCase();
                let matchedColor = false;

                if (nColor && (dbBarcode.includes(nColor) || dbOption.includes(nColor) || dbName.includes(nColor) || dbCode.includes(nColor))) {
                    score += 30;
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
                        if (COLOR_MAP[engColor].some(kc => kc === normalizedColorVal)) {
                            if (dbBarcode.includes(normalizeStr(engColor)) || dbOption.includes(normalizeStr(engColor))) {
                                score += 15;
                                matchedColor = true;
                                break;
                            }
                        }
                    }
                }

                colorMatched = matchedColor;
            }

            // 4. 카테고리 우선순위 (의류 vs 잡화)
            // 숫자 사이즈(100~160 등)가 있는 경우, 잡화보다는 의류 카테고리를 우선 매칭합니다.
            const cleanSize = record.size.replace(/[^0-9]/g, '');
            const isNumericSize = cleanSize.length >= 2 && parseInt(cleanSize) >= 80;
            
            if (isNumericSize) {
                const clothingKws = ['세트', '원피스', '상의', '하의', '아우터', '팬츠', '티셔츠', '가디건', '자켓', '코트', '레깅스', '슈트', '복'];
                const accessoryKws = ['잡화', '모자', '가방', '양말', '헤어', '악세', '소품', '스카프', '목도리', '밴드'];
                
                const dbNameStr = row['상품명'] || '';
                if (clothingKws.some(kw => dbNameStr.includes(kw))) {
                    score += 10; // 의류 가산점
                }
                if (accessoryKws.some(kw => dbNameStr.includes(kw))) {
                    score -= 15; // 잡화 감점 (숫자 사이즈일 때)
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = row;
                tiedMatches = [row];
                bestSizeMatched = sizeMatched;
                bestColorMatched = colorMatched;
            } else if (score === bestScore) {
                tiedMatches.push(row);
            }
        });

        // 완벽한 매칭(상품명+색상+사이즈)이 아니면(점수가 너무 낮으면) 실패 처리 방어
        const isValidMatch = bestMatch && bestScore >= 25;

        // 최고점이 서로 다른 상품코드 여러 개에 동시에 걸리면(카탈로그에 동일 상품명+옵션이
        // 여러 코드로 중복 등록된 경우) 임의로 하나를 확정하지 않고 수동 확인을 요청한다.
        // 단, AI 학습으로 확정된 매칭(100점 이상)은 예외로 그대로 신뢰한다.
        const distinctTiedCodes = Array.from(new Set(tiedMatches.map(r => r['상품코드'])));
        const isAmbiguous = isValidMatch && bestScore < 100 && distinctTiedCodes.length > 1;

        // 상품코드/상품명/색상/사이즈가 실제 DB 데이터와 전부 일치하는지 (프론트 초록/빨강 표시용)
        const isVerified = isValidMatch && !isAmbiguous && bestSizeMatched && bestColorMatched;

        return {
            productCode: !isValidMatch ? '미매칭' : (isAmbiguous ? '중복확인' : bestMatch!['상품코드']),
            sheetName: !isValidMatch ? record.pdfName : (isAmbiguous ? `${bestMatch!['상품명']} [후보코드: ${distinctTiedCodes.join('/')}]` : bestMatch!['상품명']),
            color: normalizeColor(record.color),
            size: record.size,
            qty: record.qty,
            originalStyle: record.styleNo,
            originSheet: record.sheetName,
            boxNo: record.boxNo,
            boxCount: record.boxCount,
            verified: isVerified
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
        { header: '시트명', key: 'originSheet', width: 20 },
        { header: '원래스타일', key: 'originalStyle', width: 20 },
        { header: '박스번호', key: 'boxNo', width: 15 },
        { header: '박스수', key: 'boxCount', width: 10 },
        { header: '검증', key: 'verified', width: 8 }
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
            memo: `${memoDate}_${type === 'china' ? '중국 입고' : type === 'domestic' ? '국내 입고' : '인도 입고'}`,
            originSheet: r.originSheet,
            originalStyle: r.originalStyle,
            boxNo: r.boxNo,
            boxCount: r.boxCount,
            verified: r.verified ? 'Y' : 'N'
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
