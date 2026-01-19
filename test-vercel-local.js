const handler = require('./api/screenshot');
const fs = require('fs');
const path = require('path');

// Mock Request and Response
const req = {
    body: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        section: 'header',
        addBrowserBar: true
    }
};

const res = {
    setHeader: (k, v) => console.log(`[Header] ${k}: ${v}`),
    status: (code) => {
        console.log(`[Status] ${code}`);
        return {
            send: (buffer) => {
                console.log(`[Response] Buffer received, length: ${buffer.length}`);
                fs.writeFileSync(path.join(__dirname, 'test_output.png'), buffer);
                console.log('Saved to test_output.png');
            },
            json: (obj) => console.log('[JSON]', obj)
        }
    }
};

console.log('Running local test...');
handler(req, res).then(() => console.log('Done'));
