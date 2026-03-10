// enrolment.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const router = express.Router();

// Paths for enrolment
const ENROLMENT_CA = '/home/atlas/scoring-broker/ca';
const ENROLMENT_DEVICES = '/home/atlas/scoring-broker/devices';
const PAIRING_FILE = '/var/lib/scoring-broker/pairing.json';

// Helper to check if pairing is enabled
function isPairingEnabled() {
  try {
    const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
    if (!data.enabled) return false;
    const now = Math.floor(Date.now() / 1000);
    return data.expiresAt > now;
  } catch (err) {
    console.warn('Failed to read pairing file:', err.message);
    return false;
  }
}

// =====================
// Pairing Endpoint
// =====================
router.post('/pairing/enable', (req, res) => {
  console.log('Received request to enable pairing');

  execFile('/usr/local/bin/enable-pairing.sh', (err) => {
    if (err) {
      console.error('Error enabling pairing:', err.message);
      return res.status(500).send(`Failed to enable pairing: ${err.message}`);
    }
    console.log('Pairing enabled for 2 minutes');
    res.send('Pairing enabled for 2 minutes');
  });
});

// =====================
// Device Enrolment Endpoint
// =====================
router.post('/enrol', (req, res) => {
  console.log('Received enrolment request');

  if (!isPairingEnabled()) {
    console.warn('Pairing disabled. Rejecting enrolment.');
    return res.status(403).send('Pairing disabled');
  }

  const { deviceId, csrPem } = req.body;

  if (!deviceId || !csrPem) {
    console.warn('Missing parameters in enrol request:', req.body);
    return res.status(400).send('Missing parameters: deviceId or csrPem');
  }

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(ENROLMENT_DEVICES, `${deviceId}.crt`);

  console.log('CSR file will be written to:', csrFile);
  console.log('Device certificate will be stored at:', certFile);

  try {
    fs.writeFileSync(csrFile, csrPem);
    console.log(`CSR written successfully for device ${deviceId}`);
  } catch (err) {
    console.error('Failed to write CSR:', err.message);
    return res.status(500).send(`Failed to write CSR: ${err.message}`);
  }

  // Sign CSR using helper script
  execFile(
    'sudo',
    ['/usr/local/bin/sign-device-cert.sh', csrFile, certFile],
    (error, stdout, stderr) => {
      console.log('Signing script stdout:', stdout);
      console.log('Signing script stderr:', stderr);

      if (error) {
        console.error('Signing failed:', error.message);
        return res.status(500).send(`Failed to sign certificate: ${error.message}`);
      }

      try {
        // Cleanup CSR
        fs.unlinkSync(csrFile);
        console.log('CSR file deleted after signing');

        // Read signed certificate
        const certPem = fs.readFileSync(certFile, 'utf8');
        const caPem = fs.readFileSync(path.join(ENROLMENT_CA, 'ca.crt'), 'utf8');

        console.log(`Device ${deviceId} enrolled successfully`);
        console.log('Returned certificate length:', certPem.length);
        console.log('CA certificate length:', caPem.length);

        res.json({
          deviceCert: certPem,
          caCert: caPem
        });
      } catch (err) {
        console.error('Post-signing error:', err.message);
        res.status(500).send(`Failed after signing: ${err.message}`);
      }
    }
  );
});

module.exports = router;