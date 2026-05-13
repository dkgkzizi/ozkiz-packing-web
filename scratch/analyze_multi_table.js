const XLSX = require('xlsx');

const filePath = 'C:\\Users\\ozkiz\\Downloads\\20260509-OH-LCL.XLS';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames.filter(n => n.includes('OH'))[0] || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Analyzing ${sheetName}...`);

    jsonData.forEach((row, idx) => {
        if (!Array.isArray(row)) return;
        const rowStr = row.join('|');
        
        // Find all '품명' occurrences
        const nameCols = [];
        row.forEach((cell, cellIdx) => {
            if (String(cell || "").trim() === '품명') nameCols.push(cellIdx);
        });

        if (nameCols.length > 0) {
            console.log(`ROW ${idx} has ${nameCols.length} tables. Cols: ${nameCols.join(', ')}`);
            nameCols.forEach((nCol, tIdx) => {
                // Find associated columns for this table
                let colorCol = -1, totalCol = -1, boxCol = -1, ctCol = -1;
                // Search in a reasonable range after nCol
                const endCol = nameCols[tIdx + 1] || row.length;
                for (let i = nCol + 1; i < endCol; i++) {
                    const c = String(row[i] || "").trim().toUpperCase();
                    if (c === '칼라' || c === '색상') colorCol = i;
                    else if (c === '합계' || c === '수량') totalCol = i;
                    else if (c.includes('NO') || c.includes('박스')) boxCol = i;
                    else if (c === 'C/T' || c.includes('박스수')) ctCol = i;
                }
                console.log(`  Table ${tIdx}: name=${nCol}, color=${colorCol}, total=${totalCol}, box=${boxCol}, ct=${ctCol}`);
            });
        }
    });
} catch (e) {
    console.error(e);
}
