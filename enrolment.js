const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const router = express.Router();

// Change these paths to your actual CA and device storage locations
const ENROLMENT_CA = '/home/atlas/scoring-broker/ca';
const ENROLMENT_DEVICES = '/home/atlas/scoring-broker/devices';

// Utility: check if pairing is enabled (copy your existing logic)
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

// Device enrolment endpoint
router.post('/enrol', (req, res) => {
  if (!isPairingEnabled()) {
    return res.status(403).send('Pairing disabled');
  }

  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) {
    return res.status(400).send('Missing deviceId or csrPem');
  }

  // Prepare directories
  const deviceDir = path.join(ENROLMENT_DEVICES, deviceId);
  if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(deviceDir, `${deviceId}.crt`);

  try {
    // Write CSR to temporary file
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
      // Always cleanup CSR
      try { fs.unlinkSync(csrFile); } catch {}

      if (error) {
        console.error('Signing failed:', stderr || error);
        return res.status(500).send('Failed to sign certificate');
      }

      try {
        // Read signed device certificate
        if (!fs.existsSync(certFile)) {
          console.error('Certificate file missing after signing');
          return res.status(500).send('Certificate missing after signing');
        }

        const deviceCert = fs.readFileSync(certFile, 'utf8');
        const caCert = fs.readFileSync(path.join(ENROLMENT_CA, 'ca.crt'), 'utf8');

        console.log(`Device ${deviceId} enrolled successfully`);

        // Return JSON with device and CA certs
        res.json({ deviceCert, caCert });
      } catch (err) {
        console.error('Post-signing error:', err);
        res.status(500).send('Failed after signing');
      }
    }
  );
});

module.exports = router;