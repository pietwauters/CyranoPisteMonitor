const express = require('express');
const https = require('https');
const mqtt = require('mqtt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Load SSL certificate
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// -----------------
// File uploads
// -----------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    cb(mimetype && extname ? null : new Error('Only image files allowed!'), true);
  }
});

// -----------------
// Web pages
// -----------------
app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/piste-mgt', (req, res) => res.sendFile(__dirname + '/public/piste-mgt.html'));
app.get('/overview', (req, res) => res.sendFile(__dirname + '/public/overview.html'));
app.get('/piste/:number', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// -----------------
// Image upload/delete
// -----------------
app.post('/upload-fencer-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { pisteNumber, position } = req.body;
    if (!pisteNumber || !position) return res.status(400).json({ error: 'Missing pisteNumber or position' });

    const uploadPath = path.join(__dirname, 'public', 'fencers', `piste-${pisteNumber}`);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    const ext = path.extname(req.file.originalname);
    const filename = `${position}${ext}`;
    const filepath = path.join(uploadPath, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename,
      path: `/fencers/piste-${pisteNumber}/${filename}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/delete-fencer-image/:pisteNumber/:position', (req, res) => {
  try {
    const { pisteNumber, position } = req.params;
    const dirPath = path.join(__dirname, 'public', 'fencers', `piste-${pisteNumber}`);
    if (!fs.existsSync(dirPath)) return res.json({ success: true, message: 'No images to delete' });

    let deleted = false;
    fs.readdirSync(dirPath).forEach(file => {
      if (path.parse(file).name === position) {
        fs.unlinkSync(path.join(dirPath, file));
        deleted = true;
      }
    });

    res.json({ success: true, message: deleted ? 'Image deleted successfully' : 'No image found' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------
// Mount enrolment API
// -----------------
app.use(express.json()); // JSON parser
const enrolmentRouter = require('./enrolment');
app.use('/api', enrolmentRouter);

// -----------------
// Serve static files
// -----------------
app.use(express.static('public'));

// -----------------
// MQTT
// -----------------
const mqttBroker = process.env.MQTT_BROKER || 'mqtts://localhost:8883';
let client = mqtt.connect(mqttBroker, { rejectUnauthorized: false });

client.on('connect', () => console.log('Connected to MQTT broker at', mqttBroker));
client.on('error', (err) => {
  console.error('MQTT error:', err && err.message ? err.message : err);
  if (mqttBroker.startsWith('mqtts://')) {
    const fallback = 'mqtt://localhost:1883';
    client.end(true);
    client = mqtt.connect(fallback);
    client.on('connect', () => console.log('Connected to MQTT broker at', fallback));
    client.on('error', (e) => console.error('MQTT fallback error:', e && e.message ? e.message : e));
  }
});

// -----------------
// Start HTTPS
// -----------------
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Server running at https://localhost:${port}`);
});