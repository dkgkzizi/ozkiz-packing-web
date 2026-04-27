import ExcelJS from 'exceljs';
import pool from '@/lib/db';

function normalizeStr(s: any) {
    if (!s) return "";
    return s.toString().replace(/[^0-9A-Z가-힣]/gi, '').toUpperCase();
}

export async function matchExcelBuffer(buffer: Buffer, type: string = 'india', fileName: string = ""): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const excelRecords: any[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const styleNo = row.getCell(1).text.trim();
        if (!styleNo || styleNo.includes('합계')) return;
        excelRecords.push({
            styleNo: styleNo,
            pdfName: row.getCell(2).text.trim(),
            color: row.getCell(3).text.trim(),
            size: row.getCell(4).text.trim(),
            qty: parseInt(row.getCell(5).value as any) || 0
        });
    });

    const client = await pool.connect();
    let dbRows: any[] = [];
    try {
        const uniqueStyles = Array.from(new Set(excelRecords.map(r => r.styleNo).filter(s => s && s.length >= 3)));
        if (uniqueStyles.length > 0) {
            const patterns = uniqueStyles.map(s => `%${normalizeStr(s)}%`);
            const res = await client.query(`
                SELECT * FROM products 
                WHERE "바코드" ILIKE ANY($1) OR "상품코드" ILIKE ANY($1)
            `, [patterns]);
            dbRows = res.rows;
        }
    } finally {
        client.release();
    }

    const finalResults = excelRecords.map(record => {
        const nStyle = normalizeStr(record.styleNo);
        // [핵심] 스타일 번호가 바코드나 상품코드에 포함된 상품만 검색
        const bestMatch = dbRows.find(row => 
            normalizeStr(row['바코드']).includes(nStyle) || 
            normalizeStr(row['상품코드']).includes(nStyle)
        );

        return {
            productCode: bestMatch ? bestMatch['상품코드'] : '미매칭',
            sheetName: bestMatch ? bestMatch['상품명'] : record.pdfName,
            color: record.color, // PDF 원본 보존
            size: record.size,   // PDF 원본 보존
            qty: record.qty,
            originalStyle: record.styleNo
        };
    });

    const outWb = new ExcelJS.Workbook();
    const outWs = outWb.addWorksheet('매칭결과');
    const memoDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    outWs.columns = [
        { header: '상품코드', key: 'productCode', width: 20 },
        { header: '상품명', key: 'sheetName', width: 40 },
        { header: '색상', key: 'color', width: 15 },
        { header: '사이즈', key: 'size', width: 12 },
        { header: '작업수량', key: 'qty', width: 15 },
        { header: '메모', key: 'memo', width: 25 }
    ];

    const hRow = outWs.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53E3E' } };

    finalResults.forEach(r => {
        outWs.addRow({
            productCode: r.productCode,
            sheetName: r.sheetName,
            color: r.color,
            size: r.size,
            qty: r.qty,
            memo: `${memoDate}_인도 입고`
        });
    });

    outWs.eachRow(row => {
        row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });

    return outWb;
}
