const express = require('express');
const mqtt = require('mqtt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const pisteNumber = req.body.pisteNumber;
    const uploadPath = path.join(__dirname, 'public', 'fencers', `piste-${pisteNumber}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const position = req.body.position; // 'left' or 'right'
    const ext = path.extname(file.originalname);
    cb(null, `${position}${ext}`);
  }
});

const upload = multer({
  storage: storage,
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
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: req.file.filename,
      path: `/fencers/piste-${req.body.pisteNumber}/${req.file.filename}`
    });
  } catch (error) {
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
