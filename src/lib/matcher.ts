import ExcelJS from 'exceljs';
import https from 'https';

// 구글 시트 매칭데이터 URL (CSV 포맷)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VzyHFgij9ye8UGKCvZI1u-UgkfE_TMBcBl_DFFBe174/export?format=csv&gid=1734406793';

const COLOR_MAP: Record<string, string[]> = {
    'IVORY': ['아이보리', '화이트', '크림', '백아이보리'],
    'WHITE': ['화이트', '아이보리', '백아이보리'],
    'BLACK': ['블랙', '검정'],
    'PINK': ['핑크', '분홍', '핫핑크', '연핑크'],
    'YELLOW': ['옐로우', '노랑'],
    'MELANGE': ['멜란지', '회색', '그레이'],
    'GRAY': ['그레이', '회색', '멜란지'],
    'BEIGE': ['베이지', '오트밀'],
    'BLUE': ['블루', '파랑', '민트'],
    'NAVY': ['네이비', '남색'],
    'RED': ['레드', '빨강', '와인'],
    'GREEN': ['그린', '초록'],
    'MINT': ['민트'],
    'PURPLE': ['퍼플', '보라', '라벤더'],
    'CHARCOAL': ['차콜', '먹색'],
    'CORAL': ['코랄'],
    'PEACH': ['피치'],
    'BROWN': ['브라운', '갈색', '코코아'],
    'WINE': ['와인', '레드'],
    'LAVENDER': ['라벤더', '퍼플'],
    'KHAKI': ['카키']
};

async function fetchCSV(url: string, hops = 0): Promise<string> {
    if (hops > 5) throw new Error('Too many redirects');
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchCSV(res.headers.location, hops + 1));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch CSV: ${res.statusCode}`));
                return;
            }
            const chunks: any[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const fullBuffer = Buffer.concat(chunks);
                resolve(fullBuffer.toString('utf8'));
            });
        }).on('error', (err) => reject(err));
    });
}

function parseCSV(text: string) {
    let result: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let field = '';
    for (let c of text) {
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { row.push(field); field = ''; }
        else if ((c === '\n' || c === '\r') && !inQuotes) {
            if (c === '\r') continue;
            row.push(field); result.push(row); row = []; field = '';
        } else field += c;
    }
    if (field !== '') row.push(field);
    if (row.length > 0) result.push(row);
    return result;
}

function normalizeStr(s: any) {
    if (!s) return "";
    // 숫자 0과 대문자 O를 혼용하는 경우가 많아 O로 통일하여 비교
    return s.toString()
        .replace(/[^0-9A-Z]/gi, '')
        .toUpperCase()
        .replace(/0/g, 'O');
}

function normalizeColor(c: any) {
    if (!c) return "";
    return c.toString().trim().toUpperCase();
}

function getSimilarity(s1: string, s2: string) {
    if (!s1 || !s2) return 0;
    s1 = s1.toLowerCase().replace(/\s+/g, '');
    s2 = s2.toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1.0;
    const pairs1 = getBigrams(s1), pairs2 = getBigrams(s2);
    const union = pairs1.length + pairs2.length;
    let hit = 0;
    for (const x of pairs1) { for (const y of pairs2) { if (x === y) hit++; } }
    return hit > 0 ? (2.0 * hit) / union : 0;
}

function getBigrams(str: string) {
    const pairs = [];
    for (let i = 0; i < str.length - 1; i++) pairs.push(str.substring(i, i + 2));
    return pairs;
}

export async function matchExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    
    const excelRecords: any[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const styleNo = row.getCell(1).text.trim();
        const pdfName = row.getCell(2).text.trim();
        
        // '총 합계' 또는 스타일 번호가 없거나, 합계 성격의 행 제외
        if (!styleNo || styleNo.includes('합계') || styleNo === 'STYLE NO' || styleNo.includes('TOTAL') || styleNo.includes('Total')) return;
        if (pdfName.includes('합계') || pdfName.includes('TOTAL')) return;
        
        excelRecords.push({
            styleNo: styleNo,
            pdfName: row.getCell(2).text.trim(),
            color: row.getCell(3).text.trim(),
            size: row.getCell(4).text.trim(),
            qty: parseInt(row.getCell(5).value as any) || 0
        });
    });

    const csvText = await fetchCSV(SHEET_URL);
    const csvData = parseCSV(csvText);
    const sheetRecords: any[] = [];
    for(let i = 1; i < csvData.length; i++) {
        const r = csvData[i];
        if (r.length >= 3) {
            sheetRecords.push({
                productCode: r[0]?.trim() || '',
                productName: r[1]?.trim() || '',
                option: r[2]?.trim() || '',
                styleNo: r[3]?.trim() || '',
                normStyle: normalizeStr(r[3])
            });
        }
    }

    const matchedRaw: any[] = [];
    excelRecords.forEach(ex => {
        if (!ex.styleNo) return;
        const exNormStyle = normalizeStr(ex.styleNo);
        let matches = sheetRecords.filter(s => s.normStyle === exNormStyle || s.styleNo === ex.styleNo);
        
        // 스타일 번호가 완벽히 일치하지 않을 경우 유사도 검색 (부분 일치)
        if (matches.length === 0 && exNormStyle.length >= 4) {
            matches = sheetRecords.filter(s => s.normStyle.includes(exNormStyle) || exNormStyle.includes(s.normStyle));
        }

        if (matches.length === 0) {
            matches = sheetRecords.filter(s => s.productName.toUpperCase().includes(exNormStyle));
        }

        let bestMatch: any = null, bestScore = -1;
        if (matches.length > 0) {
            const exColor = normalizeColor(ex.color);
            const koColors = COLOR_MAP[exColor] || [];
            for(let m of matches) {
                let score = 0;
                const opt = m.option.replace(/\s+/g, '').toUpperCase();
                
                // 1. 스타일 번호 완전 일치 가산점
                if (m.styleNo.toUpperCase() === ex.styleNo.toUpperCase() || m.normStyle === exNormStyle) score += 40;
                
                // 2. 사이즈 일치 가산점
                if (ex.size) {
                    const normSize = ex.size.replace(/\s+/g, '').toUpperCase();
                    if (opt.includes(`:${normSize}`) || opt === normSize) score += 20;
                    else if (opt.includes(normSize)) score += 10;
                }
                
                // 3. 색상 일치 가산점
                if (ex.color && opt.includes(ex.color.replace(/\s+/g, '').toUpperCase())) score += 15;
                else { 
                    for(let syn of koColors) { 
                        if (opt.toUpperCase().includes(syn.replace(/\s+/g, ''))) { 
                            score += 15; 
                            break; 
                        } 
                    } 
                }
                
                // 4. 상품명 유사도 가산점
                const sim = getSimilarity(ex.pdfName, m.productName);
                if (sim >= 0.6) score += (sim * 20);
                
                if (score > bestScore) { bestScore = score; bestMatch = m; }
            }
        }
        
        const originalKey = `${ex.styleNo}|${ex.pdfName}|${ex.color}|${ex.size}`;
        
        if (bestMatch && bestScore >= 30) {
            // 슈파베이스 옵션(:네이비, :140)에서 한글 색상 추출 시도
            let korColor = ex.color;
            const optParts = bestMatch.option.split(',').map((p:string) => p.replace(/[:\s]/g, '').trim());
            
            // COLOR_MAP에 정의된 한글 동의어와 옵션값 비교
            const exColorKey = ex.color.toUpperCase();
            const synonyms = COLOR_MAP[exColorKey] || [];
            
            for(let p of optParts) {
                if (synonyms.includes(p) || p === ex.color) {
                    korColor = p;
                    break;
                }
            }

            matchedRaw.push({
                productCode: bestMatch.productCode,
                sheetName: bestMatch.productName,
                color: korColor, 
                size: ex.size, 
                qty: ex.qty,
                originalKey: originalKey
            });
        } else {
            matchedRaw.push({
                productCode: '미매칭',
                sheetName: ex.pdfName,
                color: ex.color,
                size: ex.size,
                qty: ex.qty,
                originalKey: originalKey
            });
        }
    });

    const aggregated: Record<string, any> = {};
    matchedRaw.forEach(item => {
        const key = `${item.productCode}|${item.sheetName}|${item.color}|${item.size}`;
        if (aggregated[key]) {
            aggregated[key].qty += item.qty;
            if (!aggregated[key].originalKeys) aggregated[key].originalKeys = [];
            aggregated[key].originalKeys.push(item.originalKey);
        } else {
            aggregated[key] = { ...item, originalKeys: [item.originalKey] };
        }
    });

    const finalResults = Object.values(aggregated).sort((a,b) => {
        if (a.productCode === '미매칭' && b.productCode !== '미매칭') return 1;
        if (a.productCode !== '미매칭' && b.productCode === '미매칭') return -1;
        return a.sheetName.localeCompare(b.sheetName);
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('매칭결과');
    
    // 오늘 날짜 메모용 (YYMMDD 형식)
    const today = new Date();
    const memoDate = today.toISOString().slice(2, 10).replace(/-/g, '');
    const memoContent = `${memoDate}_인도 입고`;

    outWs.columns = [
        { header: '상품코드', key: 'productCode', width: 20 },
        { header: '상품명', key: 'sheetName', width: 40 },
        { header: '색상', key: 'color', width: 15 },
        { header: '사이즈', key: 'size', width: 12 },
        { header: '작업수량', key: 'qty', width: 15 },
        { header: '메모', key: 'memo', width: 25 },
        { header: '식별키 (검증용)', key: 'originalKeys', width: 35, hidden: true }
    ];

    // 헤더 디자인 복구 (파란 배경, 흰 글씨)
    const headerRow = outWs.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.alignment = { horizontal: 'center' as any, vertical: 'middle' as any };
    
    let totalQty = 0;
    finalResults.forEach(r => {
        const row = outWs.addRow({
            productCode: r.productCode,
            sheetName: r.sheetName,
            color: r.color,
            size: r.size,
            qty: r.qty,
            memo: memoContent,
            originalKeys: r.originalKeys.join(';')
        });
        totalQty += r.qty;
        if (r.productCode === '미매칭') {
            row.eachCell(c => { c.font = { color: { argb: 'FFFF0000' } }; });
        }
    });

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin' as any}, left: {style:'thin' as any}, bottom: {style:'thin' as any}, right: {style:'thin' as any} };
            cell.alignment = { horizontal: 'center' as any, vertical: 'middle' as any };
        });
    });

    return outWb;
}
