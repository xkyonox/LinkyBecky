const express = require('express');
const { Pool } = require('@neondatabase/serverless');
const cors = require('cors');

// Create a separate standalone app just for API testing
const app = express();

// Initialize connection to database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Simple status endpoint
app.get('/api/status', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: "API is working!",
    time: new Date().toISOString(),
    apiServerMode: true
  });
});

// Username availability endpoint
app.get('/api/username/:username', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { username } = req.params;
    
    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ 
        available: false, 
        message: "Username must be 3-20 characters and only contain letters, numbers, and underscores." 
      });
    }
    
    // Check if username exists
    const result = await pool.query(
      'SELECT EXISTS (SELECT 1 FROM users WHERE username = $1) as exists',
      [username]
    );
    
    const userExists = result.rows[0].exists;
    
    return res.json({
      available: !userExists,
      message: userExists 
        ? "Username is already taken." 
        : "Username is available."
    });
  } catch (error) {
    console.error("Error checking username:", error);
    return res.status(500).json({
      available: false,
      message: "Server error checking username availability."
    });
  }
});

// Start the server on a different port
const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API test server running at http://localhost:${PORT}`);
});