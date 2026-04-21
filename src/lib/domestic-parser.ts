import * as XLSX from 'xlsx';

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

/**
 * 국내 패킹리스트 범용 지능형 파서 (XLS, XLSX, Gemini AI OCR 지원)
 */
export async function getDomesticPackingResults(buffer: Buffer, fileName: string = ""): Promise<PackingResult[]> {
  const isExcel = fileName.toLowerCase().endsWith('.xls') || fileName.toLowerCase().endsWith('.xlsx');

  // 1. 엑셀 파일 처리 (기존 로직 유지 - 속도가 빠름)
  if (isExcel || buffer.slice(0, 4).toString('hex') === '504b0304' || buffer.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      let results: PackingResult[] = [];
      if (jsonData.length > 0) {
          jsonData.forEach((row) => {
              if (!Array.isArray(row)) return;
              let style = "";
              let foundStyleIdx = -1;
              for (let i = 0; i < Math.min(row.length, 5); i++) {
                  const val = String(row[i] || "").trim();
                  if (/^[A-Z][0-9]{4,10}$/.test(val) || (val.length >= 6 && val.startsWith('S'))) {
                      style = val;
                      foundStyleIdx = i;
                      break;
                  }
              }
              if (style) {
                  for (let i = foundStyleIdx + 1; i < row.length; i++) {
                      const val = parseInt(String(row[i] || "").replace(/[^0-9]/g, ''));
                      if (val > 0 && val < 5000) {
                        results.push({
                            style: style,
                            name: String(row[foundStyleIdx + 1] || "국내 상품").trim(),
                            color: String(row[foundStyleIdx + 2] || "기본").trim(),
                            size: "FREE",
                            qty: val
                        });
                        break;
                      }
                  }
              }
          });
          if (results.length > 0) return results;
      }
    } catch (e) {}
  }

  // 2. 이미지/PDF 처리 (Google Gemini 1.5 API 사용)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const isPDF = buffer.slice(0, 4).toString('hex') === '25504446'; // %PDF
  const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';
  const base64Data = buffer.toString('base64');

  const prompt = `
당신은 대한민국 최고의 악필(Handwriting) 판독 전문가이자 패킹리스트 분석가입니다. 
제공된 이미지는 '민주' 업체를 포함해 다양한 수기 리스트이며, 글씨체가 상당히 흘려 써져 있어 판독이 어렵습니다. 하지만 당신은 문맥과 획의 흐름을 분석해 100% 정확하게 추출해야 합니다.

판독 및 추출 특화 가이드:
1. 단계별 분석 (Chain of Thought):
   - 먼저 상품명이 적힌 칸의 전체적인 획의 모양을 보세요.
   - '원피스-반짝보랏빛'과 같이 상품 형상(원피스)과 수식어(반짝보랏빛)가 결합된 구조를 파악하세요. 
   - '하의-솔솔'처럼 카테고리(하의, 상의, 원피스)로 시작하는 패턴이 많음을 인지하세요. '하'와 '상'을 명확히 구분하세요.

2. 악필 판독 팁:
   - '나비'와 '보랏빛' 등 자음/모음이 유사해 보이는 경우, 전체 단어의 맥락에서 더 자연스러운 단어를 선택하세요.
   - 글자가 겹쳐 있거나 흐릿해도 한글 특유의 초/중/종성 구조를 끝까지 추적하세요.

3. 업체별 레이아웃 재강조:
   - 민주(Minju): 상단의 사이즈(100, 110, 120...) 열과 상품 행의 교차점에 적힌 숫자를 절대 놓치지 마세요. 'X'는 0개입니다.

4. 상품명 정제 필수: 
   - 상품명 옆의 괄호나 색상 정보는 제외하고 순수 상품명만 'productName'에 넣으세요.
   - 예: '하의-솔솔 (기모치랭스)' -> '하의-솔솔'

출력 형식 (반드시 유효한 JSON):
{
  "items": [
    { "productName": "순수상품명", "color": "색상", "size": "사이즈", "qty": 수량 },
    ...
  ]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          contents: [{
              parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
          }],
          generationConfig: { response_mime_type: "application/json" }
      })
  });

  const data = await response.json();
  if (data.error) throw new Error(`Gemini API Error: ${data.error.message}`);
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Gemini로부터 결과를 받지 못했습니다.");

  const content = JSON.parse(data.candidates[0].content.parts[0].text);
  const items = content.items || [];

  return items.map((item: any) => {
      // 상품명에서 괄호 및 그 안의 내용 제거 (최종 정제)
      const cleanName = (item.productName || "").replace(/\(.*\)/g, '').trim();
      return {
          style: cleanName,
          name: cleanName || "국내 상품",
          color: item.color || "기본",
          size: item.size || "FREE",
          qty: Number(item.qty) || 0
      };
  });
}
