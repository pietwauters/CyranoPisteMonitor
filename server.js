const express = require('express');
const mqtt = require('mqtt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Configure multer for file uploads - use memory storage first
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Admin page route
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Piste Management page route
app.get('/piste-mgt', (req, res) => {
  res.sendFile(__dirname + '/public/piste-mgt.html');
});

// Direct piste display route
app.get('/piste/:number', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Upload fencer image endpoint
app.post('/upload-fencer-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const pisteNumber = req.body.pisteNumber;
    const position = req.body.position;
    
    if (!pisteNumber || !position) {
      return res.status(400).json({ error: 'Missing pisteNumber or position' });
    }
    
    // Create directory path
    const uploadPath = path.join(__dirname, 'public', 'fencers', `piste-${pisteNumber}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Determine file extension and create filename
    const ext = path.extname(req.file.originalname);
    const filename = `${position}${ext}`;
    const filepath = path.join(uploadPath, filename);
    
    // Write file to disk
    fs.writeFileSync(filepath, req.file.buffer);
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: filename,
      path: `/fencers/piste-${pisteNumber}/${filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files (HTML/CSS/JS) - must come after specific routes
app.use(express.static('public'));

// MQTT Client Configuration
const mqttBroker = 'mqtt://localhost:1883';
const client = mqtt.connect(mqttBroker);

client.on('connect', () => {
  console.log('Connected to MQTT broker');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
