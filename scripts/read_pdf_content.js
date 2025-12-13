const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('scripts/cases_batch_7.pdf');


console.log('Type of pdf:', typeof pdf);
console.log('pdf object keys:', Object.keys(pdf));

if (typeof pdf === 'function') {
    pdf(dataBuffer).then(function (data) {
        console.log(data.text);
    });
} else if (pdf.default && typeof pdf.default === 'function') {
    pdf.default(dataBuffer).then(function (data) {
        console.log(data.text);
    });
} else {
    console.log('Cannot find pdf function');
}
