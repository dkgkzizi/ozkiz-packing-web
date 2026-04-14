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
    if (match) return parseInt(match[0]);
    return 0;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'naeju';

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });
    const fileName = file.name.toLowerCase();
    
    let rawItems: any[] = [];
    let detectedSeason = "";

    // --- CASE 1: EXCEL OR CSV (AI LESS MATCHING) ---
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        
        worksheet.eachRow((row, i) => {
            if (i === 1) return; // Header
            const productName = row.getCell(1).text || row.getCell(2).text; // 1열 또는 2열에서 이름 추출
            if (productName && !productName.includes('TOTAL')) {
                rawItems.push({
                    productName: productName,
                    color: row.getCell(3).text || "",
                    size: row.getCell(4).text || "",
                    qty: parseInt(row.getCell(5).text) || 0
                });
            }
        });
    } 
    // --- CASE 2: IMAGE OR PDF (AI OCR MATCHING) ---
    else {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ 
                success: false, 
                message: 'AI 분석 전용 GEMINI_API_KEY가 없습니다. 엑셀 파일을 업로드하시거나 관리자에게 키 등록을 요청하세요.' 
            }, { status: 403 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const aiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `입고전표 JSON 추출: {items: [{productName, color, size, qty}], detectedSeason}` }, { inline_data: { mime_type: file.type, data: base64Data } }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        const aiData = await aiRes.json();
        if (!aiData.candidates?.[0]) throw new Error('AI 분석 응답 실패');
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

          if (item.color && dbRow.옵션.includes(item.color)) score += 15;
          if (item.size && dbRow.옵션.includes(item.size)) score += 15;

          const dbSeasonScore = getSeasonScore(dbRow.시즌);
          score += (dbSeasonScore * 2);

          if (detectedSeason && dbRow.시즌 && dbRow.시즌.includes(detectedSeason)) score += 50;

          if (score > maxScore) {
            maxScore = score;
            bestMatch = dbRow;
          }
        }

        const isMatched = bestMatch && maxScore >= 60;
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
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
