const express = require('express');
const https = require('https');
const mqtt = require('mqtt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
const port = 3000;

// Load SSL certificate
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};



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

// Overview page route
app.get('/overview', (req, res) => {
  res.sendFile(__dirname + '/public/overview.html');
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

// Delete fencer image endpoint
app.delete('/delete-fencer-image/:pisteNumber/:position', (req, res) => {
  try {
    const pisteNumber = req.params.pisteNumber;
    const position = req.params.position;
    
    const dirPath = path.join(__dirname, 'public', 'fencers', `piste-${pisteNumber}`);
    
    if (!fs.existsSync(dirPath)) {
      return res.json({ success: true, message: 'No images to delete' });
    }
    
    // Find and delete any file with the position name (any extension)
    const files = fs.readdirSync(dirPath);
    const extensions = ['jpg', 'jpeg', 'png', 'gif'];
    let deleted = false;
    
    files.forEach(file => {
      const fileBase = path.parse(file).name;
      if (fileBase === position) {
        fs.unlinkSync(path.join(dirPath, file));
        deleted = true;
      }
    });
    
    res.json({
      success: true,
      message: deleted ? 'Image deleted successfully' : 'No image found'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});
const enrolmentRouter = require('./enrolment');
app.use('/api', enrolmentRouter);

// Serve static files (HTML/CSS/JS) - must come after specific routes
app.use(express.static('public'));

// MQTT Client Configuration
// Prefer secure MQTT (MQTTS) on 8883. If your broker uses plain MQTT on 1883,
// set the MQTT_BROKER env var or the code will attempt a fallback.
const mqttBroker = process.env.MQTT_BROKER || 'mqtts://localhost:8883';
const mqttOptions = {
  // Allow self-signed certs for local deployments. For production, provide
  // the CA via `ca: fs.readFileSync('/path/to/ca.crt')` and set
  // `rejectUnauthorized: true`.
  rejectUnauthorized: false
};

let client = mqtt.connect(mqttBroker, mqttOptions);

client.on('connect', () => {
  console.log('Connected to MQTT broker at', mqttBroker);
});

client.on('error', (err) => {
  console.error('MQTT client error:', err && err.message ? err.message : err);
  // If the initial attempt was MQTTS and was refused, try plain MQTT on 1883 once
  if (mqttBroker.startsWith('mqtts://')) {
    const fallback = 'mqtt://localhost:1883';
    console.log('Attempting fallback to', fallback);
    try {
      client.end(true);
    } catch (e) {}
    client = mqtt.connect(fallback);
    client.on('connect', () => console.log('Connected to MQTT broker at', fallback));
    client.on('error', (e) => console.error('MQTT fallback error:', e && e.message ? e.message : e));
  }
});



// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Server running at https://localhost:${port}`);
  console.log(`Also accessible at https://10.154.1.102:${port}`);
});
