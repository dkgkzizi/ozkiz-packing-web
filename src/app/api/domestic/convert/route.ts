import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'naeju';

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    // 1. ORIGINAL DETAILED PROMPTS (RESTORED)
    const promptNaeju = `
이 이미지는 쇼핑몰에서 수기로 작성된 국내 입고패킹리스트(입고전표)입니다.
작성된 글씨가 흘려 쓴 형태일 수 있으니, 표의 열 구조를 잘 파악하여 [상품명, 색상, 사이즈, 수량]을 아주 정확히 추출해 주세요.

분석 가이드:
1. 테이블 파악: 보통 '상품명(또는 품명)', '색상', '사이즈', '수량' 순입니다. 
2. 상품명: 괄호나 하이픈이 들어간 이름을 온전하게 추출하세요.
3. 색상: 인식된 한글 색상명.
4. 사이즈: 숫자로 된 사이즈를 정확히 보세요.
5. 수량: '숫자'만 정수(integer) 형태로 추출하세요.

결과는 반드시 { "items": [ { "productName": "...", "color": "...", "size": "...", "qty": 10 } ] } 형식의 JSON이어야 합니다.
`;

    const promptMinju = `
이 파일은 '거래명세표' 형식의 입고 리스트입니다. (민주 버전) 
1. 품목(상품명): '품명' 혹은 '품목' 칸에 있는 이름을 가져오세요. 
2. 규격(색상/사이즈): '규격' 칸에 적힌 내용을 분석하세요.
3. 수량: '수량' 칸에 각 색상별 숫자를 추출하세요.

결과는 반드시 { "items": [ { "productName": "...", "color": "...", "size": "...", "qty": 10 } ] } 형식의 JSON이어야 합니다.
`;

    const promptSejong = `
이 파일은 '세종' 업체의 거래명세서입니다. 
1. 상품명(품목): '품목' 열에 적힌 이름을 추출하세요.
2. 색상/사이즈(규격): '규격' 열에 색상과 사이즈 정보가 함께 들어있을 수 있습니다. 예: 핑크/150
3. 수량: '수량' 열에 적힌 숫자를 추출하세요.

결과는 반드시 { "items": [ { "productName": "...", "color": "...", "size": "...", "qty": 10 } ] } 형식의 JSON이어야 합니다.
`;

    let selectedPrompt = promptNaeju;
    if (type === 'minju') selectedPrompt = promptMinju;
    else if (type === 'sejong') selectedPrompt = promptSejong;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: selectedPrompt }, { inline_data: { mime_type: file.type, data: base64Data } }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const aiData = await aiRes.json();
    
    // SAFETY CHECK for candidates[0]
    if (!aiData.candidates || aiData.candidates.length === 0) {
        throw new Error('AI가 이미지에서 데이터를 읽어내지 못했습니다. 파일 상태를 확인해 주세요.');
    }

    const responseText = aiData.candidates[0].content.parts[0].text;
    const rawItems = JSON.parse(responseText).items || [];

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
    console.error('OCR ERROR:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
