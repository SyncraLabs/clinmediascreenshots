// Node 18+ has native fetch
async function test() {
    try {
        console.log('Testing Footer Capture...');
        const res = await fetch('http://localhost:3000/api/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://syncralabs.es',
                viewport: { width: 1920, height: 1080 },
                section: 'footer',
                addBrowserBar: true
            })
        });

        if (res.ok) {
            console.log('Success! Request completed.');
        } else {
            console.log('Error:', await res.text());
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}
test();
