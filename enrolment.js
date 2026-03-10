// enrolment.js (router)
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ENROLMENT_CA = '/home/atlas/scoring-broker/ca';
const ENROLMENT_DEVICES = '/home/atlas/scoring-broker/devices';
const PAIRING_FILE = '/var/lib/scoring-broker/pairing.json';

function isPairingEnabled() {
  try {
    const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    return data.enabled && data.expiresAt > now;
  } catch (err) {
    console.error('Failed to read pairing file:', err);
    return false;
  }
}

// POST /api/enrol
router.post('/enrol', (req, res) => {
  console.log('--- Enrolment request received ---');

  if (!isPairingEnabled()) {
    console.log('Pairing is currently disabled.');
    return res.status(403).send('Pairing disabled');
  }

  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) {
    console.log('Missing deviceId or csrPem in request body');
    return res.status(400).send('Missing parameters');
  }

  console.log('Device ID:', deviceId);

  // Ensure device directory exists
  const deviceDir = path.join(ENROLMENT_DEVICES, deviceId);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
    console.log('Created device directory:', deviceDir);
  }

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(deviceDir, `${deviceId}.crt`);

  console.log('CSR will be saved to:', csrFile);
  console.log('Certificate will be saved to:', certFile);

  try {
    fs.writeFileSync(csrFile, csrPem);
    console.log('CSR written successfully');
  } catch (err) {
    console.error('Failed to write CSR file:', err);
    return res.status(500).send('Failed to write CSR');
  }

  // Sign the CSR
  console.log('Calling sign-device-cert.sh...');
  execFile('sudo', ['/usr/local/bin/sign-device-cert.sh', csrFile, certFile], (error, stdout, stderr) => {
    console.log('sign-device-cert.sh stdout:', stdout);
    console.log('sign-device-cert.sh stderr:', stderr);

    if (error) {
      console.error('Signing script returned error:', error);
      return res.status(500).send('Certificate signing failed');
    }

    // Check if certificate was actually created
    if (!fs.existsSync(certFile)) {
      console.error('Certificate file not found after signing:', certFile);
      return res.status(500).send('Certificate file missing after signing');
    }

    let deviceCert, caCert;
    try {
      deviceCert = fs.readFileSync(certFile, 'utf8');
      caCert = fs.readFileSync(path.join(ENROLMENT_CA, 'ca.crt'), 'utf8');
      console.log('Device certificate and CA read successfully');
    } catch (err) {
      console.error('Failed to read generated certificates:', err);
      return res.status(500).send('Failed to read generated certificates');
    }

    // Cleanup CSR
    try {
      fs.unlinkSync(csrFile);
      console.log('CSR file deleted:', csrFile);
    } catch (err) {
      console.warn('Failed to delete CSR file:', err);
    }

    console.log(`Device ${deviceId} enrolled successfully`);
    res.json({ deviceCert, caCert });
  });
});

module.exports = router;