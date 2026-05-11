const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser();
pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    let rows = {};
    pdfData.Pages[0].Texts.forEach(t => {
        let txt = "";
        try { txt = decodeURIComponent(t.R[0].T).trim(); } catch(e) { txt = t.R[0].T.trim(); }
        if(!txt) return;
        let y = t.y.toFixed(2);
        let targetY = Object.keys(rows).find(ry => Math.abs(parseFloat(ry) - parseFloat(y)) < 0.5);
        if(targetY) rows[targetY].push({x: t.x.toFixed(2), text: txt});
        else rows[y] = [{x: t.x.toFixed(2), text: txt}];
    });

    let sortedY = Object.keys(rows).sort((a,b) => parseFloat(a) - parseFloat(b));
    sortedY.forEach(y => {
        let cols = rows[y].sort((a,b) => parseFloat(a.x) - parseFloat(b.x));
        console.log(`Y: ${y} | ` + cols.map(c => `[x:${c.x}] ${c.text}`).join(' | '));
    });
});

const pdfPath = "C:\\Users\\ozkiz\\OneDrive\\바탕 화면\\패킹리스트 변환\\DPL-053R.pdf";
pdfParser.loadPDF(pdfPath);
