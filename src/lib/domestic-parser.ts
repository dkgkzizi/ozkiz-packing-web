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
당신은 한국 패킹리스트 전문 분석가입니다. 제공된 이미지는 '내주', '민주', '세종' 등 서로 다른 업체의 수기 입고 리스트입니다. 
각 업체의 고유한 작성 방식을 파악하여 [상품명, 색상, 사이즈, 수량]을 아주 정밀하게 JSON으로 추출해 주세요.

필수 요구사항:
1. 상품명 정제: 상품명에 색상 정보(예: (블랙), (옐로우))가 포함되어 있다면 이를 제외하고 순수 상품명만 추출하세요.
   - 예: '구미 베어 (블랙)' -> '구미 베어'
2. 색상 분리: 가로로 나열된 사이즈 아래의 숫자를 수량으로 매칭하며, 상품명과 별도로 색상을 정확히 기입하세요.

업체별 분석 가이드:
1. 내주 (Naeju): 상품명 아래에 (색상)이 적힌 경우, 상품명만 가져오고 색상은 따로 추출하세요.
2. 민주 (Minju): 헤더의 사이즈(100~140)별 수량을 행별 색상과 조합하세요.
3. 세종 (Sejong): 규격 칸의 색상과 사이즈를 각각 분리하세요.

출력 형식 (반드시 유효한 JSON):
{
  "items": [
    { "productName": "...", "color": "...", "size": "...", "qty": 10 },
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
