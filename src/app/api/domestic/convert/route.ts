import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import ExcelJS from 'exceljs';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

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
    const fileName = file.name.toLowerCase();
    
    let rawItems: any[] = [];
    let detectedSeason = "";

    // --- CASE 1: EXCEL OR CSV ---
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        worksheet.eachRow((row, i) => {
            if (i === 1) return;
            const pName = row.getCell(1).text || row.getCell(2).text;
            if (pName && !pName.includes('합계')) {
                rawItems.push({
                    productName: pName,
                    color: row.getCell(3).text || "",
                    size: row.getCell(4).text || "",
                    qty: Math.abs(parseInt(row.getCell(5).text)) || 0
                });
            }
        });
    } 
    // --- CASE 2: IMAGE OR PDF (AI RESTORED) ---
    else {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ 
                success: false, 
                message: 'Vercel 관리자 페이지에서 GEMINI_API_KEY를 등록해 주세요.' 
            }, { status: 403 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const aiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
                { text: `이 전표에서 [상품명, 색상, 사이즈, 수량]을 추출하고 연도가 보이면 detectedSeason에 넣으세요. JSON {items: [...], detectedSeason: "26"}` }, 
                { inline_data: { mime_type: file.type, data: base64Data } }
            ] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        const aiData = await aiRes.json();
        if (!aiData.candidates?.[0]) throw new Error('AI 분석 실패: ' + JSON.stringify(aiData.error || 'Unknown Error'));
        const parsed = JSON.parse(aiData.candidates[0].content.parts[0].text);
        rawItems = parsed.items || [];
        detectedSeason = parsed.detectedSeason || "";
    }

    // --- UNIVERSAL SUPABASE MATCHING ---
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
          if (item.color && dbRow.옵션.toString().includes(item.color)) score += 15;
          if (item.size && dbRow.옵션.toString().includes(item.size)) score += 15;
          score += (getSeasonScore(dbRow.시즌) * 2);
          if (detectedSeason && dbRow.시즌 && dbRow.시즌.includes(detectedSeason)) score += 50;
          if (score > maxScore) { maxScore = score; bestMatch = dbRow; }
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
    console.error(err);
    return NextResponse.json({ success: false, message: '매칭 처리 오류: ' + err.message }, { status: 500 });
  }
}
