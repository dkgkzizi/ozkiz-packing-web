import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

// 유사도 계산 함수 (Bigram)
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'naeju';

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });
    
    const apiKey = process.env.GEMINI_API_KEY;
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    // 1. Gemini AI OCR
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `국내 입고전표 이미지입니다. [상품명, 색상, 사이즈, 수량]을 JSON 'items' 배열로 추출하세요.`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64Data } }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const aiData = await aiRes.json();
    const rawItems = JSON.parse(aiData.candidates[0].content.parts[0].text).items || [];

    // 2. Supabase Matching
    const client = await pool.connect();
    let finalItems = [];
    try {
      const dbResult = await client.query('SELECT "상품코드", "상품명", "옵션" FROM products');
      const dbRows = dbResult.rows;

      finalItems = rawItems.map((item: any) => {
        let bestMatch = null;
        let maxScore = -1;

        for (const dbRow of dbRows) {
          let score = 0;
          const nameSim = getSimilarity(item.productName, dbRow.상품명);
          
          if (nameSim >= 0.7) score += (nameSim * 50);
          else if (dbRow.상품명.includes(item.productName) || item.productName.includes(dbRow.상품명)) score += 15;

          const dbOpt = (dbRow.옵션 || "").toString();
          if (item.color && dbOpt.includes(item.color)) score += 10;
          if (item.size && dbOpt.includes(item.size)) score += 10;

          if (score > maxScore) {
            maxScore = score;
            bestMatch = dbRow;
          }
        }

        return {
          ...item,
          matchedCode: (bestMatch && maxScore >= 15) ? bestMatch.상품코드 : '미매칭',
          matchedName: (bestMatch && maxScore >= 15) ? bestMatch.상품명 : item.productName
        };
      });
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, items: finalItems });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
