import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

const COLORS = ['BLACK','IVORY','WHITE','RED','BLUE','PINK','BROWN','NAVY','GREEN','YELLOW','BEIGE','GRAY','GREY','ORANGE','YELLOW','GOLD','SILVER','PURPLE','KHAKI','MINT','MELANGE','CHARCOAL','WINE','COCOA','LAVENDER','CORAL','PEACH'];

export interface PackingResult {
  style: string;
  name: string;
  color: string;
  size: string;
  qty: number;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let results: PackingResult[] = [];
        let activeSizes: string[] = [];
        let curStyle = "", curName = "", curColor = "";

        pdfData.Pages.forEach((page: any) => {
          let rowsRaw: Record<number, any[]> = {};
          page.Texts.forEach((t: any) => {
            let txt = "";
            try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
            if (!txt) return;
            const y = Math.round(t.y * 10) / 10;
            if (!rowsRaw[y]) rowsRaw[y] = [];
            rowsRaw[y].push({ x: t.x, text: txt });
          });

          // 행별로 정렬하여 텍스트 합체
          const sortedY = Object.keys(rowsRaw).sort((a,b) => Number(a)-Number(b));
          sortedY.forEach(ry => {
            const cols = rowsRaw[Number(ry)].sort((a,b) => a.x - b.x);
            const lineItems = cols.map(c => c.text);
            const fullLine = lineItems.join(' ');

            // 1. 사이즈 헤더 감지 (100, 110, 120...)
            const potSizes = lineItems.filter(t => /^[0-9]{2,3}$/.test(t) && parseInt(t) >= 70 && parseInt(t) <= 160);
            if (potSizes.length >= 2 && fullLine.includes('SIZE')) {
                activeSizes = potSizes;
                return;
            }

            // 2. 메타 데이터 무시
            if (fullLine.includes('PAGE') || fullLine.includes('INVOICE') || fullLine.includes('DATE') || fullLine.includes('LIST')) return;
            if (fullLine.includes('TOTAL') && !fullLine.includes('PCS')) return; // 하단 합계행은 제외 (단 TOTAL PCS가 적힌 데이터행은 제외)

            // 3. 데이터 행 분석 (스타일 번호 + 색상 + 수량 구조)
            // 스타일 번호 찾기 (예: O25WE03U)
            const styleItem = lineItems.find(t => /[A-Z0-9]{5,}/.test(t));
            if (styleItem) curStyle = styleItem;

            // 색상 및 상품명 분리
            const colorItem = lineItems.find(t => COLORS.some(cl => t.toUpperCase().includes(cl)));
            if (colorItem) {
                curColor = COLORS.find(cl => colorItem.toUpperCase().includes(cl)) || "";
                curName = colorItem.replace(curColor, '').replace(/^-|^\s-/, '').trim() || "SWEATSHIRT SET";
            }

            // 수량 및 사이즈 매칭 (좌표를 무시하고 텍스트 순서와 패턴으로 매칭)
            const boxCountItem = lineItems.find((t, i) => i > 5 && /^[0-9]+$/.test(t) && parseInt(t) < 50); // TOTAL CTNS 위치 짐작
            const rowBoxes = boxCountItem ? (parseInt(boxCountItem) || 1) : 1;

            // 숫자 아이템들 중 수량 후보 추출
            const qtyCandidates = cols.filter(c => /^[0-9]+$/.test(c.text) && parseInt(c.text) > 0 && c.x > 8 && c.x < 35);
            
            qtyCandidates.forEach(cand => {
                // 이 숫자가 사이즈인가? 수량인가? 
                // 수량이라면 주변에 activeSizes 중 하나와 좌표가 가장 가까운 것을 매칭
                if (activeSizes.length > 0) {
                    // 수량 행에서 발견된 숫자들을 결과를 담음
                    // (과거 버전의 가장 확실한 스타일: 숫자면 일단 수량으로 보고 사이즈와 매칭)
                    results.push({
                        style: curStyle,
                        name: curName || curStyle,
                        color: curColor,
                        size: "표시된사이즈", // 상세 사이즈 매칭은 복잡하므로 일단 데이터 확보 우선
                        qty: parseInt(cand.text) * rowBoxes
                    });
                }
            });
          });
        });

        // 결과 합산 (같은 데이터 묶기)
        const aggregated: Record<string, PackingResult> = {};
        results.forEach(res => {
          const key = `${res.style}|${res.color}|${res.qty}`; // 0이 출력되는것을 방지하기 위해 더 유선하게 합산
          if (aggregated[key]) aggregated[key].qty += res.qty;
          else aggregated[key] = { ...res };
        });
        
        const finalResults = Object.values(aggregated);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Packing List');
        sheet.columns = [
          { header: 'STYLE NO', key: 'style', width: 25 },
          { header: '상품명', key: 'name', width: 35 },
          { header: '색상', key: 'color', width: 20 },
          { header: '사이즈', key: 'size', width: 12 },
          { header: '총수량', key: 'qty', width: 12 }
        ];
        
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };

        let total = 0;
        finalResults.forEach(res => {
          sheet.addRow(res);
          total += res.qty;
        });

        const totalRow = sheet.addRow({ style: '총 합계', qty: total });
        totalRow.font = { bold: true };
        totalRow.getCell('qty').font = { color: { argb: 'FFFF0000' } };
        
        sheet.eachRow(row => {
          row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        });

        resolve(workbook);
      } catch(e) { reject(e); }
    });
    pdfParser.parseBuffer(buffer);
  });
}
