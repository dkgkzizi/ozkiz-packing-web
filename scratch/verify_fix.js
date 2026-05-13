
const COLOR_MAP = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍'],
};

function normalizeStr(s) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z가-힣]/gi, '').toUpperCase();
}

// 사용자님이 지적하신 문제의 핵심 로직 테스트
function testMatchingLogic(record, dbRows, historyRows) {
    console.log(`\n--- 매칭 테스트 시작 ---`);
    console.log(`입력 데이터: ${record.styleNo} | ${record.color} | ${record.size}`);
    
    const learned = historyRows.find(h => 
        h.original_style === record.styleNo && 
        (h.color === record.color || (!h.color && !record.color)) &&
        (h.size === record.size || (!h.size && !record.size))
    ) || historyRows.find(h => h.original_style === record.styleNo);

    console.log(`학습된 기록: ${learned ? `발견됨 (Style: ${learned.original_style}, Code: ${learned.product_code})` : '없음'}`);

    const nStyle = normalizeStr(record.styleNo);
    let bestMatch = null;
    let bestScore = -1;

    dbRows.forEach(row => {
        let score = 0;
        const dbName = normalizeStr(row['상품명']);
        const dbCode = normalizeStr(row['상품코드']);
        const dbOption = normalizeStr(row['옵션'] || '');

        // 0. AI 학습 가중치 (수정된 로직)
        if (learned) {
            if (row['상품명'] === learned.matched_name) {
                score += 40; // 스타일 일치 가산점
                console.log(`[${row['상품코드']}] 스타일 일치 (+40)`);
            }
            
            // 핵심 수정: 학습된 코드가 있더라도 색상/사이즈가 맞을 때만 코드 가산점(+60) 부여
            const isSkuMatch = (learned.color === record.color && learned.size === record.size);
            if (row['상품코드'] === learned.product_code && isSkuMatch) {
                score += 60;
                console.log(`[${row['상품코드']}] SKU 일치 (+60)`);
            } else if (row['상품코드'] === learned.product_code && !isSkuMatch) {
                console.log(`[${row['상품코드']}] 스타일만 일치하므로 코드 보너스 제외 (중요!)`);
            }
        }

        // 1. 기본 매칭 (사이즈/색상)
        const nSize = normalizeStr(record.size);
        if (nSize && (dbOption.includes(nSize))) {
            score += 20;
            console.log(`[${row['상품코드']}] 사이즈 일치 (+20)`);
        }

        const nColor = normalizeStr(record.color);
        if (nColor && (dbOption.includes(nColor))) {
            score += 15;
            console.log(`[${row['상품코드']}] 색상 일치 (+15)`);
        }

        console.log(`=> [${row['상품코드']}] 최종 점수: ${score}`);

        if (score > bestScore) {
            bestScore = score;
            bestMatch = row;
        }
    });

    console.log(`\n최종 선택된 코드: ${bestMatch ? bestMatch['상품코드'] : '미매칭'}`);
    console.log(`------------------------\n`);
}

// 1. DB 데이터 시뮬레이션 (아쿠아-요요 시리즈)
const dbRows = [
    { '상품명': '아쿠아-요요', '상품코드': 'S158561-1', '옵션': '블랙 / 140' },
    { '상품명': '아쿠아-요요', '상품코드': 'S158561-2', '옵션': '블랙 / 150' },
    { '상품명': '아쿠아-요요', '상품코드': 'S158561-3', '옵션': '블랙 / 160' }
];

// 2. 과거 잘못된 학습 기록 (블랙 140 코드만 저장되어 있는 상황)
const historyRows = [
    { original_style: '아쿠아슈즈-요요', matched_name: '아쿠아-요요', product_code: 'S158561-1', color: null, size: null }
];

// 3. 테스트 실행: 블랙 150을 찾을 때, 과연 140 코드를 안 끌어오는지 확인
testMatchingLogic(
    { styleNo: '아쿠아슈즈-요요', color: '블랙', size: '150' },
    dbRows,
    historyRows
);
