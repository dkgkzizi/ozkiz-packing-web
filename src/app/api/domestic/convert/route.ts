import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'naeju';

    if (!file) {
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    const prompts: Record<string, string> = {
      naeju: `이 이미지는 수기로 작성된 국내 입고패킹리스트입니다. [상품명, 색상, 사이즈, 수량]을 정확히 추출해 주세요.`,
      minju: `이 이미지는 '거래명세표' 형식의 입고 리스트입니다. [상품명, 색상, 사이즈, 수량]을 추출해 주세요.`,
      sejong: `이 이미지는 '세종' 업체의 거래명세서입니다. [상품명, 색상, 사이즈, 수량]을 추출해 주세요.`
    };

    const promptBody = `
      대상: ${prompts[type] || prompts.naeju}
      
      규칙:
      1. 결과는 반드시 JSON 배열 ['items'] 안에 객체 형태로 출력하세요.
      2. 상품명: 한글 상품명 전체.
      3. 색상: 인식된 한글 색상.
      4. 사이즈: 숫자 혹은 영문 사이즈.
      5. 수량: 숫자만(정수).
      
      출력 형식:
      {
        "items": [
          { "productName": "...", "color": "...", "size": "...", "qty": 10 }
        ]
      }
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptBody },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const responseText = data.candidates[0].content.parts[0].text;
    const content = JSON.parse(responseText);
    
    return NextResponse.json({ success: true, items: content.items || [] });

  } catch (err: any) {
    console.error('OCR API Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
