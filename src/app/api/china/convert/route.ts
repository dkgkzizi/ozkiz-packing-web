import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import ExcelJS from 'exceljs';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

// 유사도 계산 (80% 기준)
function getSimilarity(s1: string, s2: string) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase().replace(/\s+/g, '');
  s2 = s2.toLowerCase().replace(/\s+/g, '');
  if (s1 === s2) return 1.0;
  const getPairs = (s: string) => {
    const pairs = [];
    for (let i = 0; i < s.length - 1; i++) pairs.push(s.substring(i, i + 2));
    return pairs;
  };
  const p1 = getPairs(s1);
  const p2 = getPairs(s2);
  const union = p1.length + p2.length;
  let hit = 0;
  for (const x of p1) { for (const y of p2) { if (x === y) hit++; } }
  return hit > 0 ? (2.0 * hit) / union : 0;
}

function getSeasonScore(seasonStr: string) {
    if (!seasonStr) return 0;
    const match = seasonStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });
    
    // EXCEL PARSING (Targeting 2nd Tab)
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    // 0-indexed, so index 1 is the 2nd sheet
    const worksheet = workbook.worksheets[1] || workbook.worksheets[0];
    
    const rawItems: any[] = [];
    worksheet.eachRow((row, i) => {
        if (i === 1) return; // Skip Header
        
        // 중국 패킹리스트 엑셀 구조에 따라 열 번호를 조정해야 할 수 있습니다.
        // 우선 일반적인 구조(1:상품명, 2:색상, 3:사이즈, 4:수량)로 가정하되 유연하게 처리합니다.
        const pName = row.getCell(1).text || row.getCell(2).text;
        if (pName && !pName.includes('합계') && !pName.includes('TOTAL')) {
            rawItems.push({
                productName: pName,
                color: row.getCell(3).text || "", 
                size: row.getCell(4).text || "",
                qty: Math.abs(parseInt(row.getCell(5).text)) || 0
            });
        }
    });

    if (rawItems.length === 0) {
        return NextResponse.json({ success: false, message: '두 번째 탭에서 데이터를 찾을 수 없습니다.' });
    }

    // SUPABASE MATCHING
    const client = await pool.connect();
    let finalItems = [];
    try {
      const dbResult = await client.query('SELECT "상품코드", "상품명", "옵션", "시즌" FROM products');
      const dbRows = dbResult.rows;

      finalItems = rawItems.map((item: any) => {
        let bestMatch = null;
        let maxScore = -1;

        for (const dbRow of dbRows) {
          let score = 0;
          const nameSim = getSimilarity(item.productName, dbRow.상품명);
          
          if (nameSim >= 0.8) score += (nameSim * 100); 
          else if (dbRow.상품명.includes(item.productName) || item.productName.includes(dbRow.상품명)) score += 20;

          if (item.color && dbRow.옵션.includes(item.color)) score += 15;
          if (item.size && dbRow.옵션.includes(item.size)) score += 15;

          score += (getSeasonScore(dbRow.시즌) * 2);

          if (score > maxScore) {
            maxScore = score;
            bestMatch = dbRow;
          }
        }

        const isMatched = bestMatch && maxScore >= 70;
        return {
          ...item,
          matchedCode: isMatched ? bestMatch.상품코드 : '미매칭',
          matchedName: isMatched ? bestMatch.상품명 : item.productName,
          season: isMatched ? (bestMatch.시즌 || 'N/A') : 'N/A'
        };
      });
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, items: finalItems });

  } catch (err: any) {
    console.error('CHINA_MATCH_ERROR:', err);
    return NextResponse.json({ success: false, message: '중국 패킹 매칭 중 오류 발생' }, { status: 500 });
  }
}
