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
제공된 이미지는 다양한 전수조사 리스트이며, 글씨체가 상당히 흘려 써져 있어 판독이 어렵습니다. 하지만 당신은 문맥과 획의 흐름을 분석해 정확하게 추출해야 합니다.

업체별 스타일 분석 및 대응 가이드:
1. 세종 (Sejong - 신발 업체):
   - 특징: 'LED 구두', '샌들', '단화' 등 신발 품명이 주를 이루며, 사이즈가 150~230 등 세 자리 숫자(신발 사이즈)입니다.
   - 주의: 수기 중 'LED 구두'라는 글자가 필기체 특성상 '너구리'나 '려구' 등으로 보일 수 있습니다. 주변 사이즈(150, 160 등)를 보고 반드시 신발임을 인지하여 '너구리' 같은 오판독을 피하고 핵심 품명(예: 체리블라썸) 혹은 정확한 전체 품명을 추출하세요.
2. 내주/민주 (Clothing - 의류 업체):
   - 특징: 상의, 하의, 원피스 위주의 품명이며 사이즈가 100~140 등 의류 사이즈입니다.
   - 주의: 세종(신발)의 상품이 의류 상품으로 오매칭되지 않도록 품명과 사이즈 단위를 교차 검증하세요.

판독 특화 로직:
- '상품명' 추출 시: '(핑크)', '(네이비)' 처럼 뒤에 괄호로 적힌 색상 정보나 'LED 구두', '샌들' 등 범용적인 접미사는 가급적 제거하고 상품 고유의 이름(예: '체리블라썸') 위주로 'productName'에 넣으세요.
- 악필 처리: 글자가 겹쳐 있거나 흐릿해도 한글 특유의 초/중/종성 구조를 끝까지 추적하여 가장 자연스러운 상품명을 도출하세요.

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
