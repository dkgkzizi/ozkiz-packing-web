const ExcelJS = require('exceljs');
const path = require('path');

async function checkExcel() {
    try {
        const workbook = new ExcelJS.Workbook();
        const filePath = path.resolve('..', '매칭결과_260331_DPL-069.xlsx');
        console.log('Reading from:', filePath);
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        
        console.log('--- Headers ---');
        console.log(JSON.stringify(sheet.getRow(1).values.slice(1)));
        
        console.log('--- First 5 Data Rows ---');
        for (let i = 2; i <= 6; i++) {
            const row = sheet.getRow(i).values.slice(1);
            if (row.length === 0) break;
            console.log(JSON.stringify(row));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkExcel();
