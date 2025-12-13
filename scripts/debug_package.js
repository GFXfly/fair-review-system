
const fs = require('fs');
try {
    const content = fs.readFileSync('node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs', 'utf8');
    console.log(content.substring(0, 500));
} catch (e) {
    console.error(e);
}
