const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

// Import the serverless function handler
// Note: We need to adapt it slightly because Vercel functions export `(req, res) => ...`
const screenshotHandler = require('./api/screenshot');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve the UI

// API Route adapted for Express
app.post('/api/screenshot', async (req, res) => {
    // Mock the Vercel/Lambda environment variables if needed for local fallback behavior
    // but the script already handles 'isVercel' check.

    console.log(`[Local API] Request received for ${req.body.url}`);

    // Call the handler
    await screenshotHandler(req, res);
});

// Root status for /api
app.get('/api', (req, res) => {
    res.send('Local API is running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 Local Server Running!`);
    console.log(`   Frontend: http://localhost:${PORT}`);
    console.log(`   API Endpoint: http://localhost:${PORT}/api/screenshot`);
});
