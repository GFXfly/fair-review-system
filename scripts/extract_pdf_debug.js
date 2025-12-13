const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('ndrc_cases_5.pdf');

// Ensure pdf is treated as the default export if needed, though usually require('pdf-parse') returns the function directly.
// Sometimes it depends on how it was installed or the version.
// Let's try to just log what `pdf` is to debug if it fails again, but here I will just assume it might need .default or similar,
// OR just use the standard usage. The previous error "pdf is not a function" suggests it might be an object.
console.log('Type of pdf export:', typeof pdf);

try {
    // If pdf is an object and has a default property that is a function
    if (typeof pdf !== 'function' && typeof pdf.default === 'function') {
        pdf.default(dataBuffer).then(function (data) {
            console.log(data.text);
        });
    } else if (typeof pdf === 'function') {
        pdf(dataBuffer).then(function (data) {
            console.log(data.text);
        });
    } else {
        console.error('pdf-parse did not export a function. Export:', pdf);
    }
} catch (e) {
    console.error(e);
}
