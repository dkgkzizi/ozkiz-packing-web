const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\ozkiz\\Downloads\\20260509-OH-LCL.XLS';
console.log('Reading file:', filePath);

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheet Names:', workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('Total Rows:', jsonData.length);
        jsonData.slice(0, 10).forEach((row, idx) => {
            console.log(`Row ${idx}:`, JSON.stringify(row));
        });

        // Test header detection
        jsonData.forEach((row, idx) => {
            if (!Array.isArray(row)) return;
            const rowStr = row.join('|');
            if (rowStr.includes('품명') && (rowStr.includes('합계') || rowStr.includes('수량'))) {
                console.log(`FOUND HEADER AT ROW ${idx}:`, rowStr);
            }
        });
    });
} catch (e) {
    console.error('Error reading file:', e);
}
