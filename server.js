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

const PAIRING_FILE = '/var/lib/scoring-broker/pairing.json';

function isPairingEnabled() {
  try {
    const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
    if (!data.enabled) return false;

    const now = Math.floor(Date.now() / 1000);
    return data.expiresAt > now;
  } catch {
    return false;
  }
}


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

// Serve static files (HTML/CSS/JS) - must come after specific routes
app.use(express.static('public'));

// MQTT Client Configuration
const mqttBroker = 'mqtt://localhost:1883';
const client = mqtt.connect(mqttBroker);

client.on('connect', () => {
  console.log('Connected to MQTT broker');
});


// === Enrolment / Pairing ===
//const ENROLMENT_CA = '/var/lib/scoring-broker/ca';
//const ENROLMENT_DEVICES = '/var/lib/scoring-broker/devices';
const ENROLMENT_CA = '/home/atlas/scoring-broker/ca';
const ENROLMENT_DEVICES = '/home/atlas/scoring-broker/devices';


// Add JSON body parsing (required for POST /enrol)
app.use(express.json());

// Pairing state
let pairingEnabled = false;

// Enable pairing endpoint (protected by optional PIN)
app.post('/api/pairing/enable', (req, res) => {
  const { execFile } = require('child_process');

  execFile('/usr/local/bin/enable-pairing.sh', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to enable pairing');
    }
    res.send('Pairing enabled for 2 minutes');
  });
});


// Device enrolment endpoint
app.post('/api/enrol', (req, res) => {
   if (!isPairingEnabled()) {
    return res.status(403).send('Pairing disabled');
  }

  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) {
    return res.status(400).send('Missing parameters');
  }

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(ENROLMENT_DEVICES, `${deviceId}.crt`);

  try {
    // Write CSR to temp file
    fs.writeFileSync(csrFile, csrPem);
  } catch (err) {
    console.error('Failed to write CSR:', err);
    return res.status(500).send('Failed to write CSR');
  }

  // Sign CSR using privileged helper
  execFile(
    'sudo',
    ['/usr/local/bin/sign-device-cert.sh', csrFile, certFile],
    (error, stdout, stderr) => {
      if (error) {
        console.error('Signing failed:', stderr || error);
        return res.status(500).send('Failed to sign certificate');
      }

      try {
        // Cleanup CSR
        fs.unlinkSync(csrFile);

        // Return signed certificate
        const certPem = fs.readFileSync(certFile, 'utf8');
        res.json({ cert: certPem });

        console.log(`Device ${deviceId} enrolled successfully`);
      } catch (err) {
        console.error('Post-signing error:', err);
        res.status(500).send('Failed after signing');
      }
    }
  );
});


// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Server running at https://localhost:${port}`);
  console.log(`Also accessible at https://10.154.1.102:${port}`);
});
