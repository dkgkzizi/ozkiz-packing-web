import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

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
    const apiKey = process.env.GEMINI_API_KEY;

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ success: false, message: 'AI 분석용 GEMINI_API_KEY가 없습니다.' }, { status: 403 });

    // --- AI ANALYSIS (Direct Excel Processing) ---
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    
    // Using Gemini 1.5 Flash to look at the Excel file directly (Doc comprehension)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const prompt = `
당신은 물류 전문가입니다. 첨부된 중국 패킹리스트 엑셀 파일을 분석하세요.
핵심 요구사항:
1. 엑셀의 **두 번째 탭(Sheet 2)**을 분석하세요.
2. 표에는 '제작사진', '품명', '칼라', '사이스별 수량(90~FREE)'이 매트릭스 형태로 되어 있습니다.
3. **이미지와 품명을 함께 고려하세요.** 중국인들이 작성하여 오타가 많습니다 (예: '드림리본'을 '드리미리본'으로 작성 등). 이미지를 보고 실제 한국 상품명으로 유추하여 정정하세요.
4. 각 상품의 [원래 이름, 색상, 사이즈, 수량]을 개별 행으로 추출하세요. 수량이 있는 칸만 추출합니다.

출력 형식 (유효한 JSON만):
{
  "items": [
    { "productName": "정제된상품명", "color": "색상", "size": "사이즈", "qty": 10 },
    ...
  ]
}
`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: base64Data } }
        ] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
      })
    });

    const aiData = await aiRes.json();
    if (!aiData.candidates?.[0]) throw new Error('AI 분석 실패: ' + JSON.stringify(aiData.error || 'Empty response'));
    
    const parsed = JSON.parse(aiData.candidates[0].content.parts[0].text);
    const rawItems = parsed.items || [];

    // --- SUPABASE MASTER MATCHING ---
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
    console.error('CHINA_INTEL_SYNC_ERROR:', err);
    return NextResponse.json({ success: false, message: '중국 지능형 매칭 중 오류 발생: ' + err.message }, { status: 500 });
  }
}
