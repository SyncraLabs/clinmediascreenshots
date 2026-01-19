const https = require('https');

const data = JSON.stringify({
    url: 'https://example.com'
});

const options = {
    hostname: 'clinmediascreenshots.vercel.app',
    port: 443,
    path: '/api/screenshot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Probing:', options.hostname + options.path);

const fs = require('fs');
const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        fs.writeFileSync('error.json', body);
        console.log('Saved to error.json');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
