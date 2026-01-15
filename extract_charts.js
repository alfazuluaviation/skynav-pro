const fs = require('fs');

try {
    const buffer = fs.readFileSync('sbsv_aerodromos.html');
    let content = '';

    // Check for UTF-16LE BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf8');
    }

    const regex = /Cartas\s*[(]/i;
    let match = regex.exec(content);
    if (match) {
        console.log('--- FOUND "Cartas" ---');
        console.log(content.substring(match.index, match.index + 2000));
    } else {
        console.log('--- "Cartas" NOT FOUND ---');
        console.log('File length:', buffer.length);
        console.log('Sample bytes:', buffer.slice(0, 10));
    }
} catch (e) {
    console.error('Error:', e.message);
}
