module.exports = (req, res) => {
    res.status(200).send(`
      <h1>Screenshot API is Running 🟢</h1>
      <p>Usage: POST /api/screenshot</p>
      <p>Current Time: ${new Date().toISOString()}</p>
    `);
};
