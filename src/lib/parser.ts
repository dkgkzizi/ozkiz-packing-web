import PDFParser from 'pdf2json';
import ExcelJS from 'exceljs';

const COLORS = ['BLACK','IVORY','WHITE','RED','BLUE','PINK','BROWN','NAVY','GREEN','YELLOW','BEIGE','GRAY','GREY','ORANGE','YELLOW','GOLD','SILVER','PURPLE','KHAKI','MINT','MELANGE','CHARCOAL','WINE','COCOA','LAVENDER','CORAL','PEACH', 'OATMEAL', 'CREAM', 'CHOCO', 'LIME', 'MINT', 'SKY', 'WASHED', 'DENIM'];

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
        let activeSizes: Record<string, string> = {};
        let curStyle = "", curName = "", curColor = "";
        let curBoxes = 1;

        pdfData.Pages.forEach((page: any, pageIdx: number) => {
          let rowsRaw: Record<string, any[]> = {};
          page.Texts.forEach((t: any) => {
            let txt = "";
            try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = (t.R[0].T).trim(); }
            if (!txt) return;
            
            // 좌표를 더 유연하게 묶음 (0.5 허용 오차)
            let y = t.y;
            let targetY = Object.keys(rowsRaw).find(ry => Math.abs(parseFloat(ry) - y) < 0.5);
            if (targetY) rowsRaw[targetY].push({ x: t.x, text: txt });
            else rowsRaw[y] = [{ x: t.x, text: txt }];
          });

          let sortedY = Object.keys(rowsRaw).sort((a,b)=>Number(a)-Number(b));
          sortedY.forEach(ry => {
            let cols = rowsRaw[ry].sort((a,b) => a.x - b.x);
            
            // 1. CTN/STYLE 영역 감지
            let styleInZone = cols.find(c => c.x >= 2.5 && c.x < 8.0 && c.text.length >= 3 && !['PCS','CTN','QTY','TOTAL','DATE'].some(k => c.text.toUpperCase().includes(k)));
            
            // 2. COLOUR / 상품명 영역 (IVORY - TOP AND BTM 형태)
            let nameColorCand = cols.find(c => c.x >= 6.5 && c.x < 15.0 && c.text.length > 2);

            // 3. 수량 데이터 존재 확인 (9.0~35.0 사이의 숫자들)
            let hasQtyData = cols.some(c => c.x >= 9.0 && c.x < 35.0 && /^[0-9]+$/.test(c.text.replace(/[^0-9]/g,'')));
            
            const isMeta = cols.some(c => ['PAGE', 'INVOICE', 'DATE', 'PACKING', 'LIST', 'WEIGHT', 'CTN.MST'].some(k => c.text.toUpperCase().includes(k)));
            const isTotalRow = cols.some(c => c.text.toUpperCase() === 'TOTAL' || c.text === '총 합계' || c.text === '합계');

            // 데이터 행 인지 판단
            let isDataRow = (!!styleInZone || (hasQtyData && curStyle.length > 0)) && !isTotalRow && !isMeta;

            if (isDataRow) {
              if (styleInZone) curStyle = styleInZone.text;
              
              if (nameColorCand) {
                let r = nameColorCand.text;
                // 한 칸에 여러 정보가 있을 때 (-, /, ( 등) 분리 알고리즘
                const splitters = [' - ', ' / ', ' (', '-', '/', '('];
                let foundSplit = false;
                for (const s of splitters) {
                  if (r.includes(s)) {
                    let pts = r.split(s).map((p: string)=>p.trim().replace(')', ''));
                    if (COLORS.some(cl => pts[0].toUpperCase().includes(cl))) { 
                      curColor = pts[0]; 
                      curName = pts.slice(1).join(s).trim(); 
                    } else if (pts[1] && COLORS.some(cl => pts[1].toUpperCase().includes(cl))) {
                      curColor = pts[1];
                      curName = pts[0];
                    } else {
                      curName = pts[0];
                      curColor = pts.slice(1).join(s).trim();
                    }
                    foundSplit = true; break;
                  }
                }
                if (!foundSplit) {
                  const foundColor = COLORS.find(cl => r.toUpperCase().includes(cl));
                  if (foundColor) {
                    curColor = r;
                    curName = curStyle; // 상품명이 없으면 스타일번호로 대체
                  } else {
                    curName = r;
                  }
                }
              }

              // 사이즈별 수량 매칭 추출
              Object.entries(activeSizes).forEach(([sx, sVal]) => {
                let sxNum = parseFloat(sx);
                let qtyCol = cols.find(c => Math.abs(c.x - sxNum) < 1.0);
                if (qtyCol) {
                  let q = parseInt(qtyCol.text.replace(/[^0-9]/g,'')) || 0;
                  if (q > 0 && q < 1000) { // 비정상적인 큰 수는 제외
                    results.push({ 
                        style: curStyle, 
                        name: curName || curStyle, 
                        color: curColor, 
                        size: sVal, 
                        qty: q 
                    });
                  }
                }
              });
            } else if (!isTotalRow && !isMeta) {
              // 사이즈 헤더(100, 110, 120...) 감지 로직 강화
              let potSizes = cols.filter(c => 
                c.x >= 9.0 && c.x < 30.0 && 
                c.text.length <= 8 && 
                !['STYLE','COLOR','PCS','CTN','TOTAL','PCS'].some(k => c.text.toUpperCase().includes(k)) &&
                /^[0-9A-Z\/\-]+$/.test(c.text.replace(/[^0-9A-Z/\-]/g,''))
              );
              if (potSizes.length >= 2) {
                activeSizes = {}; 
                potSizes.forEach(sc => { activeSizes[sc.x] = sc.text; });
              }
            }
          });
        });

        // 결과 합산 (같은 상품/색상/사이즈 중복 방지)
        const aggregated: Record<string, PackingResult> = {};
        results.forEach(res => {
          const key = `${res.style}|${res.name}|${res.color}|${res.size}`;
          if (aggregated[key]) {
            aggregated[key].qty += res.qty;
          } else {
            aggregated[key] = { ...res };
          }
        });
        
        const finalResults = Object.values(aggregated).sort((a,b) => a.style.localeCompare(b.style));

        // 엑셀 파일 생성
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Packing List');
        sheet.columns = [
          { header: 'STYLE NO', key: 'style', width: 25 },
          { header: '상품명', key: 'name', width: 35 },
          { header: '색상', key: 'color', width: 20 },
          { header: '사이즈', key: 'size', width: 12 },
          { header: '총수량', key: 'qty', width: 12 }
        ];
        
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        headerRow.alignment = { horizontal: 'center' };

        let totalQtySum = 0;
        finalResults.forEach(res => {
          sheet.addRow(res);
          totalQtySum += res.qty;
        });

        // 엑셀 하단 총 합계 행 추가
        const totalRow = sheet.addRow({ style: '총 합계', qty: totalQtySum });
        totalRow.font = { bold: true };
        totalRow.getCell('qty').font = { color: { argb: 'FFFF0000' }, bold: true };
        
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
